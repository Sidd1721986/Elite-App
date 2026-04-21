using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EliteApp.API.Data;
using EliteApp.API.Models;
using System.Security.Claims;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _context;

    public MessagesController(AppDbContext context)
    {
        _context = context;
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirst("id")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(userIdStr, out var userId))
        {
            return userId;
        }
        return Guid.Empty;
    }

    // GET: api/messages/admin-id
    // Projects only the Id — never loads PasswordHash or other sensitive fields.
    [HttpGet("admin-id")]
    public async Task<ActionResult<Guid>> GetDefaultAdminId()
    {
        var adminId = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "Admin" && u.IsActive)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync();

        if (adminId == null) return NotFound(new { message = "No admin found" });
        return Ok(adminId.Value);
    }

    // POST: api/messages
    [HttpPost]
    public async Task<ActionResult<Message>> SendMessage(MessageDto messageDto)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(messageDto.Content))
            return BadRequest(new { message = "Message content cannot be empty." });
        if (messageDto.ReceiverId == Guid.Empty)
            return BadRequest(new { message = "ReceiverId is required." });
        if (messageDto.ReceiverId == currentUserId)
            return BadRequest(new { message = "Cannot send a message to yourself." });

        var receiverExists = await _context.Users.AsNoTracking()
            .AnyAsync(u => u.Id == messageDto.ReceiverId && u.IsActive);
        if (!receiverExists)
            return BadRequest(new { message = "Recipient not found." });

        var message = new Message
        {
            SenderId = currentUserId,
            ReceiverId = messageDto.ReceiverId,
            Content = messageDto.Content,
            Timestamp = DateTime.UtcNow,
            IsRead = false
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, message);
    }

    // Static segments must be registered before {otherUserId} or "conversations" is parsed as a Guid and this route never runs.
    // GET: api/messages/conversations
    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        // Read only the fields needed to build the conversation list.
        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
            .OrderByDescending(m => m.Timestamp)
            .Select(m => new
            {
                m.SenderId,
                m.ReceiverId,
                m.Content,
                m.Timestamp,
                m.IsRead
            })
            .ToListAsync();

        var grouped = messages
            .GroupBy(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId);

        var otherUserIds = grouped.Select(g => g.Key).Distinct().ToList();
        var usersById = await _context.Users
            .AsNoTracking()
            .Where(u => otherUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Name, u.Email })
            .ToDictionaryAsync(u => u.Id);

        var conversations = new List<ConversationDto>(grouped.Count());
        foreach (var g in grouped)
        {
            var otherUserId = g.Key;
            usersById.TryGetValue(otherUserId, out var otherUser);
            var latestMessage = g.First();
            var unreadCount = g.Count(m => m.ReceiverId == currentUserId && !m.IsRead);

            conversations.Add(new ConversationDto
            {
                OtherUserId = otherUserId,
                OtherUserName = otherUser?.Name ?? "Unknown",
                OtherUserEmail = otherUser?.Email ?? "",
                LatestMessage = latestMessage.Content,
                Timestamp = latestMessage.Timestamp,
                UnreadCount = unreadCount
            });
        }

        return Ok(conversations);
    }

    // GET: api/messages/{otherUserId}?page=1&pageSize=50
    // Returns the most-recent N messages, oldest-first (UI scrolls up to load more).
    [HttpGet("{otherUserId}")]
    public async Task<ActionResult<IEnumerable<Message>>> GetMessages(
        Guid otherUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        pageSize = Math.Clamp(pageSize, 1, 100);

        // Mark incoming unread messages in one DB-side update.
        await _context.Messages
            .Where(m => m.SenderId == otherUserId && m.ReceiverId == currentUserId && !m.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(m => m.IsRead, true));

        // Fetch newest page first (DESC), then reverse in memory for chronological display.
        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => (m.SenderId == currentUserId && m.ReceiverId == otherUserId) ||
                        (m.SenderId == otherUserId && m.ReceiverId == currentUserId))
            .OrderByDescending(m => m.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        messages.Reverse(); // oldest → newest for the UI
        return Ok(messages);
    }
}

public class MessageDto
{
    public Guid ReceiverId { get; set; }
    public string Content { get; set; } = string.Empty;
}

public class ConversationDto
{
    public Guid OtherUserId { get; set; }
    public string OtherUserName { get; set; } = string.Empty;
    public string OtherUserEmail { get; set; } = string.Empty;
    public string LatestMessage { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public int UnreadCount { get; set; }
}


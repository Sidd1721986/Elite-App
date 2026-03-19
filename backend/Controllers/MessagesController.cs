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
    [HttpGet("admin-id")]
    public async Task<ActionResult<Guid>> GetDefaultAdminId()
    {
        var admin = await _context.Users.FirstOrDefaultAsync(u => u.Role == "Admin");
        if (admin == null) return NotFound("No admin found");
        return Ok(admin.Id);
    }

    // POST: api/messages
    [HttpPost]
    public async Task<ActionResult<Message>> SendMessage(MessageDto messageDto)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

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

        return Ok(message);
    }

    // GET: api/messages/{otherUserId}
    [HttpGet("{otherUserId}")]
    public async Task<ActionResult<IEnumerable<Message>>> GetMessages(Guid otherUserId)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        var messages = await _context.Messages
            .Where(m => (m.SenderId == currentUserId && m.ReceiverId == otherUserId) ||
                        (m.SenderId == otherUserId && m.ReceiverId == currentUserId))
            .OrderBy(m => m.Timestamp)
            .ToListAsync();

        // Mark messages as read
        var unreadMessages = messages.Where(m => m.ReceiverId == currentUserId && !m.IsRead).ToList();
        if (unreadMessages.Any())
        {
            foreach (var msg in unreadMessages)
            {
                msg.IsRead = true;
            }
            await _context.SaveChangesAsync();
        }

        return Ok(messages);
    }

    // GET: api/messages/conversations
    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        // Get all messages where the current user is either sender or receiver
        var messages = await _context.Messages
            .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
            .OrderByDescending(m => m.Timestamp)
            .ToListAsync();

        var grouped = messages
            .GroupBy(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId);

        var conversations = new List<ConversationDto>();
        foreach (var g in grouped)
        {
            var otherUserId = g.Key;
            var otherUser = await _context.Users.FindAsync(otherUserId);
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


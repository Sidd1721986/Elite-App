using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using EliteApp.API.Data;
using EliteApp.API.Models;

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
        // "id" is the only claim carrying the user's Guid — Sub (which maps to NameIdentifier)
        // holds the email, so it must never be used as a fallback here.
        var userIdStr = User.FindFirst("id")?.Value;
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
    [EnableRateLimiting("send-message")]
    public async Task<ActionResult<Message>> SendMessage(MessageDto messageDto)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(messageDto.Content))
            return BadRequest(new { message = "Message content cannot be empty." });
        if (messageDto.Content.Length > 10_000)
            return BadRequest(new { message = "Message content exceeds the 10,000 character limit." });
        if (messageDto.ReceiverId == Guid.Empty)
            return BadRequest(new { message = "ReceiverId is required." });
        if (messageDto.ReceiverId == currentUserId)
            return BadRequest(new { message = "Cannot send a message to yourself." });

        var receiver = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == messageDto.ReceiverId && u.IsActive);
        if (receiver == null)
            return BadRequest(new { message = "Recipient not found." });

        // #26 Relationship guard — prevent unsolicited DMs. Allowed only when one party is an
        // Admin (support), or the two share a job (customer ↔ assigned vendor).
        if (!User.IsInRole("Admin") && receiver.Role != "Admin")
        {
            var shareJob = await _context.Jobs.AsNoTracking().AnyAsync(j =>
                (j.CustomerId == currentUserId && j.VendorId == messageDto.ReceiverId) ||
                (j.CustomerId == messageDto.ReceiverId && j.VendorId == currentUserId));
            if (!shareJob)
                return StatusCode(403, new { message = "You can only message users you share a job with." });
        }

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
    [EnableRateLimiting("read-messages")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == Guid.Empty)
            return Unauthorized();

        // Aggregate per-conversation metadata in the database rather than materializing the
        // user's entire message history. Each query below returns at most one row per
        // conversation partner (bounded by contacts, not message volume), grouping on a real
        // indexed column so the work happens server-side.
        //
        // Outgoing leg: latest timestamp per partner the current user has messaged.
        var sent = await _context.Messages
            .AsNoTracking()
            .Where(m => m.SenderId == currentUserId)
            .GroupBy(m => m.ReceiverId)
            .Select(g => new { OtherUserId = g.Key, LastTimestamp = g.Max(m => m.Timestamp) })
            .ToListAsync();

        // Incoming leg: latest timestamp + unread count per partner who has messaged the user.
        var received = await _context.Messages
            .AsNoTracking()
            .Where(m => m.ReceiverId == currentUserId)
            .GroupBy(m => m.SenderId)
            .Select(g => new
            {
                OtherUserId = g.Key,
                LastTimestamp = g.Max(m => m.Timestamp),
                UnreadCount = g.Count(m => !m.IsRead)
            })
            .ToListAsync();

        // Merge the two legs into one entry per partner.
        var convosByPartner = new Dictionary<Guid, (DateTime LastTimestamp, int UnreadCount)>();
        foreach (var s in sent)
            convosByPartner[s.OtherUserId] = (s.LastTimestamp, 0);
        foreach (var r in received)
        {
            if (convosByPartner.TryGetValue(r.OtherUserId, out var existing))
                convosByPartner[r.OtherUserId] = (existing.LastTimestamp > r.LastTimestamp ? existing.LastTimestamp : r.LastTimestamp, r.UnreadCount);
            else
                convosByPartner[r.OtherUserId] = (r.LastTimestamp, r.UnreadCount);
        }

        if (convosByPartner.Count == 0)
            return Ok(new List<ConversationDto>());

        var otherUserIds = convosByPartner.Keys.ToList();
        var latestTimestamps = convosByPartner.Values.Select(v => v.LastTimestamp).Distinct().ToList();

        // Fetch the content of each conversation's latest message. Bounded by the set of
        // latest timestamps (one per conversation); matched back to the partner below.
        var latestRows = await _context.Messages
            .AsNoTracking()
            .Where(m => (m.SenderId == currentUserId && latestTimestamps.Contains(m.Timestamp))
                     || (m.ReceiverId == currentUserId && latestTimestamps.Contains(m.Timestamp)))
            .Select(m => new
            {
                Partner = m.SenderId == currentUserId ? m.ReceiverId : m.SenderId,
                m.Content,
                m.Timestamp
            })
            .ToListAsync();

        var latestContentByPartner = latestRows
            .Where(r => convosByPartner.TryGetValue(r.Partner, out var v) && v.LastTimestamp == r.Timestamp)
            .GroupBy(r => r.Partner)
            .ToDictionary(g => g.Key, g => g.First().Content);

        var usersById = await _context.Users
            .AsNoTracking()
            .Where(u => otherUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Name, u.Email })
            .ToDictionaryAsync(u => u.Id);

        var conversations = convosByPartner
            .Select(kvp =>
            {
                usersById.TryGetValue(kvp.Key, out var otherUser);
                latestContentByPartner.TryGetValue(kvp.Key, out var latestContent);
                return new ConversationDto
                {
                    OtherUserId = kvp.Key,
                    OtherUserName = otherUser?.Name ?? "Unknown",
                    OtherUserEmail = otherUser?.Email ?? "",
                    LatestMessage = latestContent ?? "",
                    Timestamp = kvp.Value.LastTimestamp,
                    UnreadCount = kvp.Value.UnreadCount
                };
            })
            .OrderByDescending(c => c.Timestamp)
            .ToList();

        return Ok(conversations);
    }

    // GET: api/messages/{otherUserId}?page=1&pageSize=50
    // Returns the most-recent N messages, oldest-first (UI scrolls up to load more).
    [HttpGet("{otherUserId}")]
    [EnableRateLimiting("read-messages")]
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


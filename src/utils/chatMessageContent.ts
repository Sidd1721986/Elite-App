const IMAGE_PAYLOAD_TYPE = 'image' as const;

export type ParsedChatMessage =
    | { kind: 'text'; text: string }
    | { kind: 'image'; url: string };

export function parseChatMessageContent(content: string): ParsedChatMessage {
    if (!content || typeof content !== 'string') {
        return { kind: 'text', text: '' };
    }
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
        try {
            const o = JSON.parse(trimmed) as { type?: string; url?: string };
            if (
                o?.type === IMAGE_PAYLOAD_TYPE &&
                typeof o.url === 'string' &&
                o.url.trim().length > 0
            ) {
                return { kind: 'image', url: o.url.trim() };
            }
        } catch {
            /* plain text that happens to start with { */
        }
    }
    return { kind: 'text', text: content };
}

export function buildImageMessageContent(imageUrl: string): string {
    return JSON.stringify({ type: IMAGE_PAYLOAD_TYPE, url: imageUrl });
}

/** Short label for conversation lists / notifications */
export function formatChatPreview(content: string): string {
    const p = parseChatMessageContent(content);
    if (p.kind === 'image') {return 'Photo';}
    const t = p.text;
    if (t.length > 80) {return `${t.slice(0, 77)}…`;}
    return t;
}

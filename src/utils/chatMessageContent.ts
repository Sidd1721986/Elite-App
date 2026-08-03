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
                const url = o.url.trim();
                // Only render peer-supplied URLs that are https. A non-https URL handed to an
                // <Image>/FastImage source would silently fire a request to an attacker-chosen
                // host (beaconing / IP grab). Anything else falls through to plain text, where
                // tapping is still gated by the validated external-URL opener.
                if (/^https:\/\//i.test(url)) {
                    return { kind: 'image', url };
                }
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

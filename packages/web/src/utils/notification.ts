export default function notification(
    title: string,
    icon: string,
    body: string,
    tag = 'tag',
    duration = 3000,
) {
    if (!window.Notification || window.Notification.permission !== 'granted') {
        return;
    }
    try {
        const options: NotificationOptions = {
            body,
            tag,
        };
        if (icon) {
            const absIcon = icon.startsWith('/') ? `${window.location.origin}${icon}` : icon;
            if (absIcon.startsWith('http') || absIcon.startsWith('https') || absIcon.startsWith('data:')) {
                options.icon = absIcon;
            }
        }
        const n = new window.Notification(title, options);
        n.onclick = function handleClick() {
            try {
                window.focus();
                this.close();
            } catch {
                // ignore
            }
        };
        const closeTimer = setTimeout(() => {
            try {
                n.close();
            } catch {
                // already closed
            }
        }, duration);
        n.onclose = () => {
            clearTimeout(closeTimer);
        };
    } catch (err) {
        console.warn('[notification]', err);
    }
}

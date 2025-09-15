self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    
    const title = data.title || 'Nowa wiadomość';
    const options = {
        body: data.body || 'Otrzymałeś nową wiadomość',
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        tag: 'message-notification',
        renotify: true,
        requireInteraction: false,
        data: data.url || '/'
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});
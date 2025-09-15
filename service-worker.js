self.addEventListener('push', function(event) {
    console.log('Service Worker: Otrzymano push message');
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
    
    console.log('Service Worker: Wyświetlam powiadomienie:', title);
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    console.log('Service Worker: Kliknięto w powiadomienie');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll().then(function(clientList) {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow(event.notification.data || '/');
        })
    );
});

self.addEventListener('message', function(event) {
    console.log('Service Worker: Otrzymano wiadomość:', event.data);
    
    if (event.data && event.data.type === 'NEW_MESSAGE') {
        const { title, body, from } = event.data;
        
        self.registration.showNotification(title, {
            body: body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'message-notification',
            renotify: true,
            requireInteraction: false,
            data: { from }
        });
    }
});
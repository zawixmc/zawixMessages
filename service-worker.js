importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDi7dQ_8WvQdIoAOgokzGs0MzOSj8VvdUw",
  authDomain: "zawix-messages.firebaseapp.com",
  projectId: "zawix-messages",
  storageBucket: "zawix-messages.firebasestorage.app",
  messagingSenderId: "730850472414",
  appId: "1:730850472414:web:dd43f62919a269e52f6d4f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let lastMessageCount = 0;
let isListening = false;

self.addEventListener('message', function(event) {
    console.log('Service Worker: Otrzymano wiadomość:', event.data);
    
    if (event.data && event.data.type === 'SET_USER') {
        currentUser = event.data.user;
        console.log('Service Worker: Ustawiono użytkownika:', currentUser?.username);
        
        if (currentUser && !isListening) {
            startListening();
        }
    }
    
    if (event.data && event.data.type === 'LOGOUT') {
        currentUser = null;
        isListening = false;
        lastMessageCount = 0;
        console.log('Service Worker: Użytkownik wylogowany');
    }
});

function startListening() {
    if (isListening || !currentUser) return;
    
    console.log('Service Worker: Rozpoczynam nasłuchiwanie wiadomości dla:', currentUser.username);
    isListening = true;
    
    db.collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            console.log('Service Worker: Otrzymano aktualizację wiadomości');
            
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            checkForNewMessages(messages);
        }, (error) => {
            console.log('Service Worker: Błąd nasłuchiwania:', error);
            isListening = false;
            setTimeout(() => {
                if (currentUser) {
                    startListening();
                }
            }, 5000);
        });
}

function checkForNewMessages(messages) {
    if (!currentUser) return;
    
    const userMessages = messages.filter(msg => 
        msg.to === currentUser.username && msg.from !== currentUser.username
    );
    
    console.log('Service Worker: Sprawdzanie wiadomości dla:', currentUser.username);
    console.log('Service Worker: Wiadomości do użytkownika:', userMessages.length);
    console.log('Service Worker: Ostatnia liczba:', lastMessageCount);
    
    if (lastMessageCount === 0) {
        lastMessageCount = userMessages.length;
        console.log('Service Worker: Inicjalizacja licznika:', lastMessageCount);
        return;
    }
    
    if (userMessages.length > lastMessageCount) {
        const newMessages = userMessages.slice(lastMessageCount);
        console.log('Service Worker: Nowych wiadomości:', newMessages.length);
        
        newMessages.forEach((msg) => {
            console.log('Service Worker: Wysyłam powiadomienie dla:', msg.message);
            
            self.registration.showNotification(`Wiadomość od ${msg.from}`, {
                body: msg.message.length > 50 ? 
                    msg.message.substring(0, 50) + '...' : 
                    msg.message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'message-notification-' + Date.now(),
                renotify: true,
                requireInteraction: false,
                data: { from: msg.from }
            });
        });
        
        lastMessageCount = userMessages.length;
    }
}

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
            return clients.openWindow('/');
        })
    );
});
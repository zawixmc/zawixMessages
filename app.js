import { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from './firebase-config.js';

const { useState, useEffect, useRef } = React;

let notificationPermission = false;
let lastMessageCount = 0;
let isInitialized = false;

const requestNotificationPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        console.log('📱 Próba uzyskania pozwolenia na powiadomienia...');
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
        
        if (notificationPermission) {
            console.log('✅ Pozwolenie na powiadomienia przyznane');
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('🔧 Service Worker zarejestrowany pomyślnie');
                
                await navigator.serviceWorker.ready;
                console.log('✅ Service Worker gotowy');
                
                return registration;
            } catch (error) {
                console.log('❌ Błąd rejestracji Service Worker:', error);
            }
        } else {
            console.log('❌ Pozwolenie na powiadomienia odrzucone');
        }
    } else {
        console.log('❌ Powiadomienia nie są obsługiwane w tej przeglądarce');
    }
    return null;
};

const setUserInServiceWorker = (user) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('📤 Wysyłam dane użytkownika do Service Worker:', user?.username);
        navigator.serviceWorker.controller.postMessage({
            type: 'SET_USER',
            user: user
        });
    }
};

const showNotification = (title, body, fromUser) => {
    console.log(`🔔 Próba wysłania powiadomienia:`);
    console.log(`   Tytuł: ${title}`);
    console.log(`   Treść: ${body}`);
    console.log(`   Od użytkownika: ${fromUser}`);
    console.log(`   Pozwolenie: ${notificationPermission ? 'TAK' : 'NIE'}`);
    
    if (notificationPermission) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('📤 Wysyłanie powiadomienia przez Service Worker...');
                return registration.showNotification(title, {
                    body: body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: 'message-notification-' + Date.now(),
                    renotify: true,
                    requireInteraction: false,
                    data: { fromUser },
                    silent: false
                });
            }).then(() => {
                console.log('✅ Powiadomienie wysłane przez Service Worker');
            }).catch(error => {
                console.log('❌ Błąd Service Worker, próbuję bezpośrednio:', error);
                try {
                    new Notification(title, {
                        body: body,
                        icon: '/favicon.ico',
                        tag: 'message-notification-' + Date.now(),
                        renotify: true,
                        data: { fromUser }
                    });
                    console.log('✅ Powiadomienie wysłane bezpośrednio');
                } catch (directError) {
                    console.log('❌ Błąd powiadomienia bezpośredniego:', directError);
                }
            });
        } else {
            console.log('📤 Wysyłanie powiadomienia bezpośrednio...');
            try {
                new Notification(title, {
                    body: body,
                    icon: '/favicon.ico',
                    tag: 'message-notification-' + Date.now(),
                    renotify: true,
                    data: { fromUser }
                });
                console.log('✅ Powiadomienie wysłane bezpośrednio');
            } catch (error) {
                console.log('❌ Błąd powiadomienia bezpośredniego:', error);
            }
        }
    } else {
        console.log('❌ Nie można wysłać powiadomienia - brak pozwolenia');
    }
};

const checkForNewMessages = (newMessages, currentUser) => {
    console.log('🔍 Sprawdzanie nowych wiadomości...');
    console.log(`   Aktualny użytkownik: ${currentUser?.username || 'brak'}`);
    console.log(`   Pozwolenie na powiadomienia: ${notificationPermission ? 'TAK' : 'NIE'}`);
    console.log(`   Zainicjalizowane: ${isInitialized ? 'TAK' : 'NIE'}`);
    
    if (!currentUser || !notificationPermission) {
        console.log('⏹️ Sprawdzanie anulowane - brak użytkownika lub pozwolenia');
        return;
    }
    
    const userMessages = newMessages.filter(msg => 
        msg.to === currentUser.username && msg.from !== currentUser.username
    );
    
    console.log(`   Wiadomości do użytkownika: ${userMessages.length}`);
    console.log(`   Ostatnia liczba wiadomości: ${lastMessageCount}`);
    
    if (!isInitialized) {
        console.log('📊 Pierwsza inicjalizacja - ustawiam licznik bez powiadomienia');
        lastMessageCount = userMessages.length;
        isInitialized = true;
        return;
    }
    
    if (userMessages.length > lastMessageCount) {
        console.log('📬 Wykryto nowe wiadomości!');
        const newMessagesForUser = userMessages.slice(lastMessageCount);
        
        newMessagesForUser.forEach((msg, index) => {
            console.log(`📧 Nowa wiadomość ${index + 1}:`);
            console.log(`   Od: ${msg.from}`);
            console.log(`   Do: ${msg.to}`);
            console.log(`   Treść: ${msg.message}`);
            
            console.log('🚀 Wysyłanie powiadomienia o nowej wiadomości...');
            showNotification(
                `Wiadomość od ${msg.from}`,
                msg.message.length > 50 ? 
                    msg.message.substring(0, 50) + '...' : 
                    msg.message,
                msg.from
            );
        });
    } else {
        console.log('✅ Brak nowych wiadomości');
    }
    
    lastMessageCount = userMessages.length;
    console.log(`📊 Zaktualizowano licznik wiadomości: ${lastMessageCount}`);
};

const linkifyText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
        if (urlRegex.test(part)) {
            return React.createElement('a', {
                key: index,
                href: part,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'message-link',
                onClick: (e) => e.stopPropagation()
            }, part);
        }
        return part;
    });
};

const MessageContent = ({ message }) => {
    return React.createElement('div', { className: 'message-content' }, 
        linkifyText(message)
    );
};

const createRipple = (event) => {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
};

const App = () => {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [messageText, setMessageText] = useState('');
    const [showLogin, setShowLogin] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
    const [messageOptions, setMessageOptions] = useState({});
    const [editingMessage, setEditingMessage] = useState(null);
    const [editText, setEditText] = useState('');
    const [deleteMessageId, setDeleteMessageId] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const body = document.body;
        if (currentUser) {
            body.className = 'chat-page';
        } else {
            body.className = 'auth-page';
        }
    }, [currentUser]);

    useEffect(() => {
        if (selectedUser) {
            scrollToBottom();
        }
    }, [selectedUser]);

    useEffect(() => {
        if (currentUser) {
            loadUsers();
            setupMessagesListener();
            requestNotificationPermission().then(() => {
                setTimeout(() => {
                    setUserInServiceWorker(currentUser);
                }, 1000);
            });
        }
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSettings && !event.target.closest('.settings-btn') && !event.target.closest('.settings-dropdown')) {
                setShowSettings(false);
            }
            if (!event.target.closest('.message-options') && !event.target.closest('.message-dots')) {
                setMessageOptions({});
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSettings]);

    const loadUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.username !== currentUser.username) {
                    usersData.push({
                        id: doc.id,
                        username: userData.username
                    });
                }
            });
            setUsers(usersData);
        } catch (err) {
            console.error('Błąd podczas ładowania użytkowników');
        }
    };

    const setupMessagesListener = () => {
        const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const messagesData = [];
            querySnapshot.forEach((doc) => {
                messagesData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setMessages(messagesData);
            checkForNewMessages(messagesData, currentUser);
        });
        
        return unsubscribe;
    };

    const validateUsername = (username) => {
        if (username.length < 3) return 'Nazwa użytkownika musi mieć minimum 3 znaki';
        if (username.length > 16) return 'Nazwa użytkownika może mieć maksymalnie 16 znaków';
        return null;
    };

    const validatePassword = (password) => {
        if (password.length < 8) return 'Hasło musi mieć minimum 8 znaków';
        if (password.length > 32) return 'Hasło może mieć maksymalnie 32 znaki';
        return null;
    };

    const handleAuth = async (username, password, isLogin) => {
        setError('');
        setSuccess('');

        const usernameError = validateUsername(username);
        if (usernameError) {
            setError(usernameError);
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        try {
            if (isLogin) {
                const querySnapshot = await getDocs(collection(db, 'users'));
                let user = null;
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.username === username && userData.password === password) {
                        user = { username: userData.username, id: doc.id };
                    }
                });

                if (user) {
                    setCurrentUser(user);
                    localStorage.setItem('currentUser', JSON.stringify(user));
                } else {
                    setError('Błędne dane logowania');
                }
            } else {
                const querySnapshot = await getDocs(collection(db, 'users'));
                let userExists = false;
                querySnapshot.forEach((doc) => {
                    if (doc.data().username === username) {
                        userExists = true;
                    }
                });

                if (userExists) {
                    setError('Użytkownik już istnieje');
                } else {
                    await addDoc(collection(db, 'users'), {
                        username,
                        password,
                        createdAt: new Date()
                    });
                    setSuccess('Rejestracja pomyślna! Możesz się teraz zalogować.');
                    setShowLogin(true);
                }
            }
        } catch (err) {
            console.error('Błąd Firebase:', err);
            setError('Błąd połączenia z bazą danych');
        }
    };

    const sendMessage = async () => {
        if (!messageText.trim() || !selectedUser) return;

        try {
            await addDoc(collection(db, 'messages'), {
                from: currentUser.username,
                to: selectedUser.username,
                message: messageText,
                timestamp: new Date()
            });
            setMessageText('');
        } catch (err) {
            console.error('Błąd podczas wysyłania wiadomości');
        }
    };

    const confirmDeleteMessage = (messageId) => {
        setDeleteMessageId(messageId);
        setShowDeleteMessageModal(true);
        setMessageOptions({});
    };

    const deleteMessage = async () => {
        try {
            await deleteDoc(doc(db, 'messages', deleteMessageId));
            setShowDeleteMessageModal(false);
            setDeleteMessageId(null);
        } catch (err) {
            console.error('Błąd podczas usuwania wiadomości');
        }
    };

    const cancelDeleteMessage = () => {
        setShowDeleteMessageModal(false);
        setDeleteMessageId(null);
    };

    const startEdit = (messageId, messageText) => {
        setEditingMessage(messageId);
        setEditText(messageText);
        setMessageOptions({});
    };

    const saveEdit = async () => {
        if (!editText.trim()) return;

        try {
            const messageRef = doc(db, 'messages', editingMessage);
            await updateDoc(messageRef, {
                message: editText,
                edited: true
            });
            setEditingMessage(null);
            setEditText('');
        } catch (err) {
            console.error('Błąd podczas edytowania wiadomości');
        }
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setEditText('');
    };

    const toggleMessageOptions = (messageId) => {
        setMessageOptions(prev => ({
            ...prev,
            [messageId]: !prev[messageId]
        }));
    };

    const logout = () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'LOGOUT'
            });
        }
        setCurrentUser(null);
        setSelectedUser(null);
        setMessages([]);
        setUsers([]);
        setShowLogin(true);
        setShowSettings(false);
        localStorage.removeItem('currentUser');
    };

    const getConversationMessages = () => {
        if (!selectedUser || !currentUser) return [];

        return messages.filter(msg => 
            (msg.from === currentUser.username && msg.to === selectedUser.username) ||
            (msg.from === selectedUser.username && msg.to === currentUser.username)
        );
    };

    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!currentUser) {
        return React.createElement(AuthForm, {
            showLogin,
            setShowLogin,
            onAuth: handleAuth,
            error,
            success
        });
    }

    return (
        <div className="container fullscreen">
            <div className="chat-container">
                <div className="sidebar">
                    <div className="user-info">
                        <h3>Witaj, {currentUser.username}!</h3>
                    </div>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Szukaj użytkowników..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="users-list">
                        {filteredUsers.map(user => (
                            <div
                                key={user.id}
                                className={`user-item ${selectedUser?.username === user.username ? 'active' : ''}`}
                                onClick={(e) => {
                                    createRipple(e);
                                    setSelectedUser(user);
                                }}
                            >
                                {user.username}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="chat-main">
                    <div className="chat-header">
                        {selectedUser && (
                            <button 
                                className="exit-chat-btn" 
                                onClick={(e) => {
                                    createRipple(e);
                                    setSelectedUser(null);
                                }}
                            >
                                ← Wyjdź
                            </button>
                        )}
                        {selectedUser ? `Rozmowa z ${selectedUser.username}` : 'Wybierz rozmowe'}
                        {!selectedUser && (
                            <>
                                <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
                                    ⚙️
                                </button>
                                {showSettings && (
                                    <div className="settings-dropdown">
                                        <div 
                                            className="settings-item" 
                                            onClick={(e) => {
                                                createRipple(e);
                                                setShowPasswordModal(true);
                                                setShowSettings(false);
                                            }}
                                        >
                                            Zmień hasło
                                        </div>
                                        <div 
                                            className="settings-item delete" 
                                            onClick={(e) => {
                                                createRipple(e);
                                                setShowDeleteModal(true);
                                                setShowSettings(false);
                                            }}
                                        >
                                            Usuń konto
                                        </div>
                                        <div 
                                            className="settings-item logout" 
                                            onClick={(e) => {
                                                createRipple(e);
                                                logout();
                                            }}
                                        >
                                            Wyloguj
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="messages-container">
                        {selectedUser && getConversationMessages().map((msg, index) => (
                            <div
                                key={msg.id}
                                className={`message ${msg.from === currentUser.username ? 'own' : 'other'}`}
                            >
                                {editingMessage === msg.id ? (
                                    <div className="edit-message">
                                        <input
                                            type="text"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                        <div className="edit-buttons">
                                            <button 
                                                onClick={(e) => {
                                                    createRipple(e);
                                                    saveEdit();
                                                }} 
                                                className="save-btn"
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    createRipple(e);
                                                    cancelEdit();
                                                }} 
                                                className="cancel-btn"
                                            >
                                                ✗
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <MessageContent message={msg.message} />
                                            {msg.edited && <span className="edited-indicator">(edytowano)</span>}
                                        </div>
                                        <div className="message-time">{msg.timestamp?.toDate?.()?.toLocaleString() || 'Teraz'}</div>
                                        {msg.from === currentUser.username && (
                                            <div 
                                                className="message-dots" 
                                                onClick={(e) => {
                                                    createRipple(e);
                                                    toggleMessageOptions(msg.id);
                                                }}
                                            >
                                                ⋮
                                            </div>
                                        )}
                                        {messageOptions[msg.id] && msg.from === currentUser.username && (
                                            <div className="message-options">
                                                <div 
                                                    className="option-item" 
                                                    onClick={(e) => {
                                                        createRipple(e);
                                                        startEdit(msg.id, msg.message);
                                                    }}
                                                >
                                                    Edytuj
                                                </div>
                                                <div 
                                                    className="option-item delete" 
                                                    onClick={(e) => {
                                                        createRipple(e);
                                                        confirmDeleteMessage(msg.id);
                                                    }}
                                                >
                                                    Usuń
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    {selectedUser && (
                        <div className="message-input">
                            <input
                                type="text"
                                placeholder="Napisz wiadomość..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            />
                            <button 
                                onClick={(e) => {
                                    createRipple(e);
                                    sendMessage();
                                }}
                            >
                                Wyślij
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {showPasswordModal && (
                <PasswordModal
                    currentUser={currentUser}
                    onClose={() => setShowPasswordModal(false)}
                />
            )}
            {showDeleteModal && (
                <DeleteAccountModal
                    currentUser={currentUser}
                    onClose={() => setShowDeleteModal(false)}
                    onDelete={logout}
                />
            )}
            {showDeleteMessageModal && (
                <DeleteMessageModal
                    onConfirm={deleteMessage}
                    onCancel={cancelDeleteMessage}
                />
            )}
        </div>
    );
};

const AuthForm = ({ showLogin, setShowLogin, onAuth, error, success }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAuth(username, password, showLogin);
        setUsername('');
        setPassword('');
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <h2>{showLogin ? 'Logowanie' : 'Rejestracja'}</h2>
            <div className="form-group">
                <label>Nazwa użytkownika:</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
            </div>
            <div className="form-group">
                <label>Hasło:</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            <button 
                type="submit" 
                className="btn"
                onClick={createRipple}
            >
                {showLogin ? 'Zaloguj się' : 'Zarejestruj się'}
            </button>
            <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                    createRipple(e);
                    setShowLogin(!showLogin);
                }}
            >
                {showLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
            </button>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
        </form>
    );
};

const PasswordModal = ({ currentUser, onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const validatePassword = (password) => {
        if (password.length < 8) return 'Hasło musi mieć minimum 8 znaków';
        if (password.length > 32) return 'Hasło może mieć maksymalnie 32 znaki';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (newPassword === oldPassword) {
            setError('Nowe hasło musi być inne niż stare hasło');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Nowe hasła nie są identyczne');
            return;
        }

        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            let userDocId = null;
            
            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.username === currentUser.username && data.password === oldPassword) {
                    userDocId = docSnapshot.id;
                }
            });

            if (!userDocId) {
                setError('Stare hasło jest nieprawidłowe');
                return;
            }

            const userRef = doc(db, 'users', userDocId);
            await updateDoc(userRef, {
                password: newPassword
            });

            setSuccess('Hasło zostało zmienione pomyślnie');
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError('Błąd podczas zmiany hasła');
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="password-modal">
                <h2 className="modal-header">Zmiana hasła</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-form-group">
                        <label>Stare hasło:</label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-form-group">
                        <label>Nowe hasło:</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-form-group">
                        <label>Potwierdź nowe hasło:</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-buttons">
                        <button 
                            type="submit" 
                            className="modal-btn modal-btn-primary"
                            onClick={createRipple}
                        >
                            Zmień hasło
                        </button>
                        <button 
                            type="button" 
                            className="modal-btn modal-btn-secondary" 
                            onClick={(e) => {
                                createRipple(e);
                                onClose();
                            }}
                        >
                            Anuluj
                        </button>
                    </div>
                    {error && <div className="error">{error}</div>}
                    {success && <div className="success">{success}</div>}
                </form>
            </div>
        </div>
    );
};

const DeleteAccountModal = ({ currentUser, onClose, onDelete }) => {
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState('');

    const canDelete = password.trim() && confirmText.toLowerCase() === 'tak';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!canDelete) return;

        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            let userDocId = null;
            
            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.username === currentUser.username && data.password === password) {
                    userDocId = docSnapshot.id;
                }
            });

            if (!userDocId) {
                setError('Nieprawidłowe hasło');
                return;
            }

            await deleteDoc(doc(db, 'users', userDocId));

            const messagesQuery = await getDocs(collection(db, 'messages'));
            const deletePromises = [];
            messagesQuery.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.from === currentUser.username || data.to === currentUser.username) {
                    deletePromises.push(deleteDoc(doc(db, 'messages', docSnapshot.id)));
                }
            });
            
            await Promise.all(deletePromises);
            onDelete();
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (err) {
            setError('Błąd podczas usuwania konta');
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="password-modal">
                <h2 className="modal-header">Usuń konto</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-form-group">
                        <label>Wpisz swoje hasło:</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-form-group">
                        <label>Wpisz "tak" aby potwierdzić usunięcie konta:</label>
                        <input
                            type="text"
                            placeholder="tak"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-buttons">
                        <button 
                            type="submit" 
                            className={`modal-btn modal-btn-delete ${canDelete ? 'active' : ''}`}
                            disabled={!canDelete}
                            onClick={canDelete ? createRipple : undefined}
                        >
                            Potwierdź
                        </button>
                        <button 
                            type="button" 
                            className="modal-btn modal-btn-secondary" 
                            onClick={(e) => {
                                createRipple(e);
                                onClose();
                            }}
                        >
                            Anuluj
                        </button>
                    </div>
                    {error && <div className="error">{error}</div>}
                </form>
            </div>
        </div>
    );
};

const DeleteMessageModal = ({ onConfirm, onCancel }) => {
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
            <div className="delete-message-modal">
                <h3>Czy na pewno chcesz usunąć tą wiadomość?</h3>
                <div className="modal-buttons">
                    <button 
                        className="modal-btn modal-btn-delete active" 
                        onClick={(e) => {
                            createRipple(e);
                            onConfirm();
                        }}
                    >
                        Potwierdź
                    </button>
                    <button 
                        className="modal-btn modal-btn-secondary" 
                        onClick={(e) => {
                            createRipple(e);
                            onCancel();
                        }}
                    >
                        Anuluj
                    </button>
                </div>
            </div>
        </div>
    );
};

ReactDOM.render(React.createElement(App), document.getElementById('root'));
import { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where } from './firebase-config.js';

const { useState, useEffect, useRef } = React;

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

const isMobile = () => {
    return window.innerWidth <= 768;
};

const App = () => {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [friendUsername, setFriendUsername] = useState('');
    const [friendStatus, setFriendStatus] = useState(null);
    const [friendRequests, setFriendRequests] = useState([]);
    const [friends, setFriends] = useState([]);
    const [activeTab, setActiveTab] = useState('friends');
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
	const [showDeleteFriendModal, setShowDeleteFriendModal] = useState(false);
	const [deleteFriendId, setDeleteFriendId] = useState(null);
	const [deleteFriendName, setDeleteFriendName] = useState('');
	const [isMobileView, setIsMobileView] = useState(isMobile());
	const [showSidebar, setShowSidebar] = useState(true);
	const messagesEndRef = useRef(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		const handleResize = () => {
			setIsMobileView(isMobile());
			if (!isMobile()) {
				setShowSidebar(true);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

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
            loadFriends();
            loadFriendRequests();
            setupMessagesListener();
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

    useEffect(() => {
        if (friendStatus) {
            const timer = setTimeout(() => {
                setFriendStatus(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [friendStatus]);

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
        });
        
        return unsubscribe;
    };

    const loadFriends = async () => {
        try {
            const friendsQuery = query(collection(db, 'friends'), 
                where('users', 'array-contains', currentUser.username));
            const snapshot = await getDocs(friendsQuery);
            const friendsList = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                const friendUsername = data.users.find(u => u !== currentUser.username);
                friendsList.push({
                    id: doc.id,
                    username: friendUsername
                });
            });
            setFriends(friendsList);
        } catch (err) {
            console.error('Error loading friends:', err);
        }
    };

    const loadFriendRequests = async () => {
        try {
            const requestsQuery = query(collection(db, 'friendRequests'), 
                where('to', '==', currentUser.username));
            const snapshot = await getDocs(requestsQuery);
            const requests = [];
            snapshot.forEach((doc) => {
                requests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setFriendRequests(requests);
        } catch (err) {
            console.error('Error loading friend requests:', err);
        }
    };

    const sendFriendRequest = async () => {
        try {
            if (!friendUsername.trim()) return;
            if (friendUsername === currentUser.username) {
                setFriendStatus({ type: 'error', message: 'Nie możesz dodać siebie do znajomych' });
                return;
            }
            const usersQuery = query(collection(db, 'users'));
            const snapshot = await getDocs(usersQuery);
            let userExists = false;
            snapshot.forEach((doc) => {
                if (doc.data().username === friendUsername) {
                    userExists = true;
                }
            });
            if (!userExists) {
                setFriendStatus({ type: 'error', message: 'Użytkownik nie istnieje' });
                return;
            }
            const friendsQuery = query(collection(db, 'friends'));
            const friendsSnapshot = await getDocs(friendsQuery);
            let alreadyFriends = false;
            friendsSnapshot.forEach((doc) => {
                const data = doc.data();
                if (Array.isArray(data.users) &&
                    data.users.includes(currentUser.username) && 
                    data.users.includes(friendUsername)) {
                    alreadyFriends = true;
                }
            });
            if (alreadyFriends) {
                setFriendStatus({ type: 'error', message: 'Masz już tą osobę w znajomych' });
                return;
            }
            const requestsQuery = query(collection(db, 'friendRequests'));
            const requestsSnapshot = await getDocs(requestsQuery);
            let requestExists = false;
            requestsSnapshot.forEach((doc) => {
                const data = doc.data();
                if ((data.from === currentUser.username && data.to === friendUsername) ||
                    (data.from === friendUsername && data.to === currentUser.username)) {
                    requestExists = true;
                }
            });
            if (requestExists) {
                setFriendStatus({ type: 'error', message: 'Zaproszenie już zostało wysłane' });
                return;
            }
            await addDoc(collection(db, 'friendRequests'), {
                from: currentUser.username,
                to: friendUsername,
                timestamp: new Date()
            });
            setFriendStatus({ type: 'success', message: 'Zaproszenie do znajomych wysłane' });
            setFriendUsername('');
        } catch (err) {
            console.error('Error sending friend request:', err);
            setFriendStatus({ type: 'error', message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.' });
        }
    };

    const acceptFriendRequest = async (request) => {
        try {
            await addDoc(collection(db, 'friends'), {
                users: [request.from, request.to],
                timestamp: new Date()
            });

            await deleteDoc(doc(db, 'friendRequests', request.id));
            
            loadFriends();
            loadFriendRequests();
        } catch (err) {
            console.error('Error accepting friend request:', err);
        }
    };

    const rejectFriendRequest = async (requestId) => {
        try {
            await deleteDoc(doc(db, 'friendRequests', requestId));
            loadFriendRequests();
        } catch (err) {
            console.error('Error rejecting friend request:', err);
        }
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
	
	const confirmDeleteFriend = (friendId, friendName) => {
		setDeleteFriendId(friendId);
		setDeleteFriendName(friendName);
		setShowDeleteFriendModal(true);
	};

	const deleteFriend = async () => {
		try {
			await deleteDoc(doc(db, 'friends', deleteFriendId));
			setShowDeleteFriendModal(false);
			setDeleteFriendId(null);
			setDeleteFriendName('');
			loadFriends();
			if (selectedUser && selectedUser.username === deleteFriendName) {
				setSelectedUser(null);
			}
		} catch (err) {
			console.error('Błąd podczas usuwania znajomego');
		}
	};

	const cancelDeleteFriend = () => {
		setShowDeleteFriendModal(false);
		setDeleteFriendId(null);
		setDeleteFriendName('');
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

	const handleExitChat = () => {
		if (isMobile()) {
			setSelectedUser(null);
			document.querySelector('.chat-main').classList.remove('selected');
			document.querySelector('.sidebar').classList.remove('hidden');
		} else {
			setSelectedUser(null);
		}
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
						{isMobile() && (
							<button 
								className="refresh-btn" 
								onClick={(e) => {
									createRipple(e);
									window.location.reload();
								}}
							>
								⟳
							</button>
						)}
						<h3>Witaj, {currentUser.username}!</h3>
						{isMobile() && (
							<button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
								⚙️
							</button>
						)}
						{showSettings && isMobile() && (
							<div className="settings-dropdown mobile-settings">
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
                    </div>
                    <div className="friends-tab-container">
                        <button 
                            className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
                            onClick={() => setActiveTab('friends')}
                        >
                            Znajomi
                        </button>
                        <button 
                            className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            Prośby ({friendRequests.length})
                        </button>
                    </div>
                    <div className="add-friend-section">
                        <input
                            type="text"
                            className="add-friend-input"
                            placeholder="Wpisz nazwę..."
                            value={friendUsername}
                            onChange={(e) => setFriendUsername(e.target.value)}
                        />
                        <button 
                            className="add-friend-btn"
                            onClick={(e) => {
                                createRipple(e);
                                sendFriendRequest();
                            }}
                        >
                            Dodaj
                        </button>
                    </div>
                    {friendStatus && (
                        <div className={`friend-status ${friendStatus.type}`}>
                            {friendStatus.message}
                        </div>
                    )}
                    <div className={`friends-content ${activeTab === 'requests' ? 'active' : ''}`}>
                        <div className="friend-requests">
                            {friendRequests.length > 0 ? (
                                friendRequests.map(request => (
                                    <div key={request.id} className="friend-request-item">
                                        <span className="friend-request-name">{request.from}</span>
                                        <div className="friend-request-buttons">
                                            <button 
                                                className="accept-btn"
                                                onClick={(e) => {
                                                    createRipple(e);
                                                    acceptFriendRequest(request);
                                                }}
                                            >
                                                Akceptuj
                                            </button>
                                            <button 
                                                className="reject-btn"
                                                onClick={(e) => {
                                                    createRipple(e);
                                                    rejectFriendRequest(request.id);
                                                }}
                                            >
                                                Odrzuć
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-friends">Brak oczekujących próśb</div>
                            )}
                        </div>
                    </div>
                    <div className={`friends-content ${activeTab === 'friends' ? 'active' : ''}`}>
                        <div className="friends-list-container">
                            {friends.length > 0 ? (
								friends.map(friend => (
									<div
										key={friend.id}
										className={`friend-item ${selectedUser?.username === friend.username ? 'active' : ''}`}
										onClick={(e) => {
											if (!e.target.closest('.friend-delete-btn')) {
												createRipple(e);
												setSelectedUser(friend);
												if (isMobile()) {
													document.querySelector('.sidebar').classList.add('hidden');
													document.querySelector('.chat-main').classList.add('selected');
												}
											}
										}}
									>
										<span className="friend-name">{friend.username}</span>
										<button 
											className="friend-delete-btn"
											onClick={(e) => {
												e.stopPropagation();
												createRipple(e);
												confirmDeleteFriend(friend.id, friend.username);
											}}
										>
											🗑️
										</button>
									</div>
								))
                            ) : (
                                <div className="no-friends">Brak dodanych znajomych</div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="chat-main">
                    <div className="chat-header">
                        {selectedUser && (
                            <button 
                                className="exit-chat-btn" 
                                onClick={(e) => {
                                    createRipple(e);
                                    handleExitChat();
                                }}
                            >
                                ← Wyjdź
                            </button>
                        )}
                        {selectedUser ? `Rozmowa z ${selectedUser.username}` : 'Wybierz rozmowe'}
                        {!selectedUser && !isMobile() && (
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
			{showDeleteFriendModal && (
				<DeleteFriendModal
					friendName={deleteFriendName}
					onConfirm={deleteFriend}
					onCancel={cancelDeleteFriend}
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

const DeleteFriendModal = ({ friendName, onConfirm, onCancel }) => {
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
            <div className="delete-friend-modal">
                <h3>Czy na pewno chcesz usunąć {friendName} ze znajomych?</h3>
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
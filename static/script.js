// JavaScript для музыкальной библиотеки

// Глобальные переменные
let currentUser = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, залогинен ли пользователь
    checkAuthStatus();
    
    // Назначаем обработчики событий
    setupEventListeners();
});

// Проверка статуса авторизации
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    if (token && userId) {
        // Проверяем валидность токена
        fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                currentUser = { id: userId };
                showDashboard();
            } else {
                // Токен недействителен, очищаем данные
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                showAuthSection();
            }
        })
        .catch(error => {
            console.error('Ошибка проверки авторизации:', error);
            showAuthSection();
        });
    } else {
        showAuthSection();
    }
}

// Назначение обработчиков событий
function setupEventListeners() {
    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Форма регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Кнопки переключения форм
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', showRegisterForm);
    }
    
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', showLoginForm);
    }
    
    const showLoginBtn = document.getElementById('show-login-btn');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', showLoginForm);
    }
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Навигация по вкладкам
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            showTab(tabId);
        });
    });
    
    // Редактирование профиля
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', toggleProfileEdit);
    }
    
    const updateProfileForm = document.getElementById('update-profile-form');
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', handleUpdateProfile);
    }
    
    // Добавление трека
    const addTrackBtn = document.getElementById('add-track-btn');
    if (addTrackBtn) {
        addTrackBtn.addEventListener('click', toggleAddTrackForm);
    }
    
    const newTrackForm = document.getElementById('new-track-form');
    if (newTrackForm) {
        newTrackForm.addEventListener('submit', handleAddTrack);
    }
    
    const cancelTrackBtn = document.getElementById('cancel-track-btn');
    if (cancelTrackBtn) {
        cancelTrackBtn.addEventListener('click', toggleAddTrackForm);
    }
    
    // Добавление исполнителя
    const addArtistBtn = document.getElementById('add-artist-btn');
    if (addArtistBtn) {
        addArtistBtn.addEventListener('click', handleAddArtist);
    }
    
    // Добавление жанра
    const addGenreBtn = document.getElementById('add-genre-btn');
    if (addGenreBtn) {
        addGenreBtn.addEventListener('click', handleAddGenre);
    }
    
    // Поиск треков
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearchTracks);
    }
    
    // Добавление коллекции
    const addCollectionBtn = document.getElementById('add-collection-btn');
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', toggleAddCollectionForm);
    }
    
    const newCollectionForm = document.getElementById('new-collection-form');
    if (newCollectionForm) {
        newCollectionForm.addEventListener('submit', handleAddCollection);
    }
    
    const cancelCollectionBtn = document.getElementById('cancel-collection-btn');
    if (cancelCollectionBtn) {
        cancelCollectionBtn.addEventListener('click', toggleAddCollectionForm);
    }
}

// Обработчики форм

function handleLogin(e) {
    e.preventDefault();
    
    const login = document.getElementById('login-input').value;
    const password = document.getElementById('password-input').value;
    
    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.user_id) {
            localStorage.setItem('authToken', data.token || 'dummy_token');
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userRole', data.role);
            currentUser = { id: data.user_id, role: data.role, login: data.login };
            
            // Обновляем UI
            document.getElementById('welcome-message').textContent = `Добро пожаловать, ${data.login}!`;
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('auth-buttons').style.display = 'none';
            
            showDashboard();
            
            // Показываем админские элементы, если пользователь админ
            if (data.role === 'admin') {
                document.getElementById('admin-menu-item').style.display = 'block';
                document.getElementById('audit-menu-item').style.display = 'block';
            }
        } else {
            alert(data.error || 'Ошибка входа');
        }
    })
    .catch(error => {
        console.error('Ошибка входа:', error);
        alert('Ошибка при попытке входа');
    });
}

function handleRegister(e) {
    e.preventDefault();
    
    const login = document.getElementById('reg-login-input').value;
    const password = document.getElementById('reg-password-input').value;
    const firstName = document.getElementById('reg-first-name-input').value;
    const lastName = document.getElementById('reg-last-name-input').value;
    const email = document.getElementById('reg-email-input').value;
    
    fetch('/api/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password, first_name: firstName, last_name: lastName, email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.user_id) {
            alert('Регистрация успешна! Теперь вы можете войти.');
            showLoginForm();
        } else {
            alert(data.error || 'Ошибка регистрации');
        }
    })
    .catch(error => {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка при попытке регистрации');
    });
}

function handleLogout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        currentUser = null;
        showAuthSection();
    })
    .catch(error => {
        console.error('Ошибка выхода:', error);
        // Даже если запрос не удался, очищаем локальные данные
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        currentUser = null;
        showAuthSection();
    });
}

// Функции отображения

function showAuthSection() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('admin-menu-item').style.display = 'none';
    document.getElementById('audit-menu-item').style.display = 'none';
}

function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    
    // Показываем информацию о пользователе
    const role = localStorage.getItem('userRole');
    if (role === 'admin') {
        document.getElementById('admin-menu-item').style.display = 'block';
        document.getElementById('audit-menu-item').style.display = 'block';
    }
    
    // Загружаем данные для активной вкладки
    const activeTab = document.querySelector('.nav-link.active').getAttribute('data-tab');
    loadTabData(activeTab);
}

function showTab(tabId) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active-tab');
    });
    
    // Убираем активный класс с навигационных ссылок
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    document.getElementById(`${tabId}-tab`).classList.add('active-tab');
    
    // Делаем активной соответствующую навигационную ссылку
    document.querySelector(`.nav-link[data-tab="${tabId}"]`).classList.add('active');
    
    // Загружаем данные для вкладки
    loadTabData(tabId);
}

function loadTabData(tabId) {
    switch(tabId) {
        case 'profile':
            loadProfileData();
            break;
        case 'tracks':
            loadTracksData();
            break;
        case 'search':
            // Ничего не загружаем, форма поиска уже есть
            break;
        case 'collections':
            loadCollectionsData();
            break;
        case 'admin':
            if (localStorage.getItem('userRole') === 'admin') {
                loadAllTracksData();
            }
            break;
        case 'audit':
            if (localStorage.getItem('userRole') === 'admin') {
                loadAuditLog();
            }
            break;
    }
}

// Функции загрузки данных

function loadProfileData() {
    fetch('/api/profile', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const profileInfo = document.getElementById('profile-info');
        if (data.login) {
            profileInfo.innerHTML = `
                <p><strong>Логин:</strong> ${data.login}</p>
                <p><strong>Имя:</strong> ${data.first_name || 'Не указано'}</p>
                <p><strong>Фамилия:</strong> ${data.last_name || 'Не указана'}</p>
                <p><strong>Email:</strong> ${data.email || 'Не указан'}</p>
                <p><strong>Дата регистрации:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
                <p><strong>Любимые жанры:</strong> ${data.favorite_genres && data.favorite_genres.length > 0 ? data.favorite_genres.join(', ') : 'Не указаны'}</p>
                <p><strong>Любимые исполнители:</strong> ${data.favorite_artists && data.favorite_artists.length > 0 ? data.favorite_artists.join(', ') : 'Не указаны'}</p>
            `;
            
            // Заполняем форму редактирования
            document.getElementById('profile-first-name').value = data.first_name || '';
            document.getElementById('profile-last-name').value = data.last_name || '';
            document.getElementById('profile-email').value = data.email || '';
            document.getElementById('profile-avatar').value = data.avatar_url || '';
        } else {
            profileInfo.innerHTML = '<p>Ошибка загрузки профиля</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки профиля:', error);
        document.getElementById('profile-info').innerHTML = '<p>Ошибка загрузки профиля</p>';
    });
}

function loadTracksData() {
    fetch('/api/tracks', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const tracksList = document.getElementById('tracks-list');
        if (data.tracks && data.tracks.length > 0) {
            let html = '<table><thead><tr><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>BPM</th><th>Длительность</th><th>Дата</th><th>Действия</th></tr></thead><tbody>';
            
            data.tracks.forEach(track => {
                const duration = track.duration_sec ? 
                    `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : 
                    'Не указана';
                
                html += `
                <tr>
                    <td>${track.title}</td>
                    <td>${track.artist_name}</td>
                    <td>${track.genre_name}</td>
                    <td>${track.bpm || 'Не указан'}</td>
                    <td>${duration}</td>
                    <td>${new Date(track.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editTrack(${track.track_id})">Редактировать</button>
                        <button class="btn btn-secondary" onclick="deleteTrack(${track.track_id})">Удалить</button>
                    </td>
                </tr>
                `;
            });
            
            html += '</tbody></table>';
            tracksList.innerHTML = html;
        } else {
            tracksList.innerHTML = '<p>У вас пока нет треков</p>';
        }
        
        // Загружаем списки для формы добавления
        loadArtistsForSelect();
        loadGenresForSelect();
    })
    .catch(error => {
        console.error('Ошибка загрузки треков:', error);
        document.getElementById('tracks-list').innerHTML = '<p>Ошибка загрузки треков</p>';
    });
}

function loadCollectionsData() {
    fetch('/api/collections', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const collectionsList = document.getElementById('collections-list');
        if (data.collections && data.collections.length > 0) {
            let html = '';
            
            data.collections.forEach(collection => {
                html += `
                <div class="collection-item">
                    <h4>${collection.name} ${collection.is_favorite ? '(Любимые треки)' : ''}</h4>
                    <p>Создана: ${new Date(collection.created_at).toLocaleDateString()}</p>
                    <p>Треков: ${collection.track_count}</p>
                    <button class="btn btn-secondary" onclick="viewCollection(${collection.collection_id})">Просмотреть</button>
                </div>
                `;
            });
            
            collectionsList.innerHTML = html;
        } else {
            collectionsList.innerHTML = '<p>У вас пока нет коллекций</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки коллекций:', error);
        document.getElementById('collections-list').innerHTML = '<p>Ошибка загрузки коллекций</p>';
    });
}

function loadAllTracksData() {
    if (localStorage.getItem('userRole') !== 'admin') {
        document.getElementById('all-tracks-list').innerHTML = '<p>Доступ запрещен</p>';
        return;
    }
    
    fetch('/api/tracks', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const tracksList = document.getElementById('all-tracks-list');
        if (data.tracks && data.tracks.length > 0) {
            let html = '<table><thead><tr><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>BPM</th><th>Длительность</th><th>Владелец</th><th>Дата</th><th>Действия</th></tr></thead><tbody>';
            
            data.tracks.forEach(track => {
                const duration = track.duration_sec ? 
                    `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : 
                    'Не указана';
                
                html += `
                <tr>
                    <td>${track.title}</td>
                    <td>${track.artist_name}</td>
                    <td>${track.genre_name}</td>
                    <td>${track.bpm || 'Не указан'}</td>
                    <td>${duration}</td>
                    <td>${track.owner_login}</td>
                    <td>${new Date(track.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="deleteTrack(${track.track_id}, true)">Удалить</button>
                    </td>
                </tr>
                `;
            });
            
            html += '</tbody></table>';
            tracksList.innerHTML = html;
        } else {
            tracksList.innerHTML = '<p>Нет треков в системе</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки всех треков:', error);
        document.getElementById('all-tracks-list').innerHTML = '<p>Ошибка загрузки треков</p>';
    });
}

function loadAuditLog() {
    if (localStorage.getItem('userRole') !== 'admin') {
        document.getElementById('audit-log').innerHTML = '<p>Доступ запрещен</p>';
        return;
    }
    
    fetch('/api/audit', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const auditLog = document.getElementById('audit-log');
        if (data.audit_log && data.audit_log.length > 0) {
            let html = '<table><thead><tr><th>Пользователь</th><th>Операция</th><th>Таблица</th><th>Запись</th><th>Время</th><th>Детали</th></tr></thead><tbody>';
            
            data.audit_log.forEach(log => {
                html += `
                <tr>
                    <td>${log.user_login || 'Система'}</td>
                    <td>${log.operation_type}</td>
                    <td>${log.table_name}</td>
                    <td>${log.record_id || '-'}</td>
                    <td>${new Date(log.operation_time).toLocaleString()}</td>
                    <td><pre>${JSON.stringify(log.details, null, 2)}</pre></td>
                </tr>
                `;
            });
            
            html += '</tbody></table>';
            auditLog.innerHTML = html;
        } else {
            auditLog.innerHTML = '<p>Журнал аудита пуст</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки журнала аудита:', error);
        document.getElementById('audit-log').innerHTML = '<p>Ошибка загрузки журнала аудита</p>';
    });
}

// Функции для работы с формами

function showLoginForm() {
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('register-form-container').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'block';
}

function toggleProfileEdit() {
    const profileInfo = document.getElementById('profile-info');
    const profileForm = document.getElementById('profile-form');
    
    if (profileForm.style.display === 'none' || profileForm.style.display === '') {
        profileInfo.style.display = 'none';
        profileForm.style.display = 'block';
    } else {
        profileInfo.style.display = 'block';
        profileForm.style.display = 'none';
    }
}

function toggleAddTrackForm() {
    const form = document.getElementById('add-track-form');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
        document.getElementById('add-track-btn').textContent = 'Отмена';
    } else {
        form.style.display = 'none';
        document.getElementById('add-track-btn').textContent = 'Добавить трек';
    }
}

function toggleAddCollectionForm() {
    const form = document.getElementById('add-collection-form');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
        document.getElementById('add-collection-btn').textContent = 'Отмена';
    } else {
        form.style.display = 'none';
        document.getElementById('add-collection-btn').textContent = 'Создать коллекцию';
    }
}

// Обработчики действий

function handleUpdateProfile(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('profile-first-name').value;
    const lastName = document.getElementById('profile-last-name').value;
    const email = document.getElementById('profile-email').value;
    const avatar = document.getElementById('profile-avatar').value;
    
    fetch('/api/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, avatar_url: avatar })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert('Профиль успешно обновлен');
            toggleProfileEdit();
            loadProfileData();
        } else {
            alert(data.error || 'Ошибка обновления профиля');
        }
    })
    .catch(error => {
        console.error('Ошибка обновления профиля:', error);
        alert('Ошибка при обновлении профиля');
    });
}

function handleAddTrack(e) {
    e.preventDefault();
    
    const title = document.getElementById('track-title').value;
    const artistId = document.getElementById('track-artist').value;
    const genreId = document.getElementById('track-genre').value;
    const bpm = document.getElementById('track-bpm').value || null;
    const duration = document.getElementById('track-duration').value || null;
    
    if (!title || !artistId || !genreId) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    fetch('/api/tracks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ title, artist_id: artistId, genre_id: genreId, bpm: bpm ? parseInt(bpm) : null, duration_sec: duration ? parseInt(duration) : null })
    })
    .then(response => response.json())
    .then(data => {
        if (data.track_id) {
            alert('Трек успешно добавлен');
            document.getElementById('new-track-form').reset();
            toggleAddTrackForm();
            loadTracksData();
        } else {
            alert(data.error || 'Ошибка добавления трека');
        }
    })
    .catch(error => {
        console.error('Ошибка добавления трека:', error);
        alert('Ошибка при добавлении трека');
    });
}

function handleAddArtist() {
    const artistName = prompt('Введите имя исполнителя:');
    if (artistName) {
        fetch('/api/artists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ name: artistName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.artist_id) {
                alert('Исполнитель успешно добавлен');
                loadArtistsForSelect();
            } else {
                alert(data.error || 'Ошибка добавления исполнителя');
            }
        })
        .catch(error => {
            console.error('Ошибка добавления исполнителя:', error);
            alert('Ошибка при добавлении исполнителя');
        });
    }
}

function handleAddGenre() {
    const genreName = prompt('Введите название жанра:');
    if (genreName) {
        fetch('/api/genres', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ name: genreName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.genre_id) {
                alert('Жанр успешно добавлен');
                loadGenresForSelect();
            } else {
                alert(data.error || 'Ошибка добавления жанра');
            }
        })
        .catch(error => {
            console.error('Ошибка добавления жанра:', error);
            alert('Ошибка при добавлении жанра');
        });
    }
}

function handleSearchTracks(e) {
    e.preventDefault();
    
    const title = document.getElementById('search-title').value;
    const artist = document.getElementById('search-artist').value;
    const genre = document.getElementById('search-genre').value;
    const minBpm = document.getElementById('search-min-bpm').value || null;
    const maxBpm = document.getElementById('search-max-bpm').value || null;
    
    fetch('/api/tracks/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
            title: title || null, 
            artist_name: artist || null, 
            genre_name: genre || null,
            min_bpm: minBpm ? parseInt(minBpm) : null,
            max_bpm: maxBpm ? parseInt(maxBpm) : null
        })
    })
    .then(response => response.json())
    .then(data => {
        const resultsDiv = document.getElementById('search-results');
        if (data.tracks && data.tracks.length > 0) {
            let html = '<table><thead><tr><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>BPM</th><th>Длительность</th><th>Дата</th></tr></thead><tbody>';
            
            data.tracks.forEach(track => {
                const duration = track.duration_sec ? 
                    `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : 
                    'Не указана';
                
                html += `
                <tr>
                    <td>${track.title}</td>
                    <td>${track.artist_name}</td>
                    <td>${track.genre_name}</td>
                    <td>${track.bpm || 'Не указан'}</td>
                    <td>${duration}</td>
                    <td>${new Date(track.created_at).toLocaleDateString()}</td>
                </tr>
                `;
            });
            
            html += '</tbody></table>';
            resultsDiv.innerHTML = html;
        } else {
            resultsDiv.innerHTML = '<p>По вашему запросу ничего не найдено</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка поиска треков:', error);
        document.getElementById('search-results').innerHTML = '<p>Ошибка поиска треков</p>';
    });
}

function handleAddCollection(e) {
    e.preventDefault();
    
    const name = document.getElementById('collection-name').value;
    const isFavorite = document.getElementById('collection-favorite').checked;
    
    if (!name) {
        alert('Пожалуйста, введите название коллекции');
        return;
    }
    
    fetch('/api/collections', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ name, is_favorite: isFavorite })
    })
    .then(response => response.json())
    .then(data => {
        if (data.collection_id) {
            alert('Коллекция успешно создана');
            document.getElementById('new-collection-form').reset();
            toggleAddCollectionForm();
            loadCollectionsData();
        } else {
            alert(data.error || 'Ошибка создания коллекции');
        }
    })
    .catch(error => {
        console.error('Ошибка создания коллекции:', error);
        alert('Ошибка при создании коллекции');
    });
}

// Вспомогательные функции

function loadArtistsForSelect() {
    // В реальном приложении нужно будет добавить API endpoint для получения всех артистов
    // Пока что просто очищаем и добавляем пару примеров
    const select = document.getElementById('track-artist');
    select.innerHTML = '<option value="">Выберите исполнителя</option>';
    
    // Заглушка - в реальном приложении нужно получить список артистов с сервера
    // fetch('/api/artists', {...})
    //   .then(data => { ... })
}

function loadGenresForSelect() {
    // В реальном приложении нужно будет добавить API endpoint для получения всех жанров
    // Пока что просто очищаем и добавляем пару примеров
    const select = document.getElementById('track-genre');
    select.innerHTML = '<option value="">Выберите жанр</option>';
    
    // Заглушка - в реальном приложении нужно получить список жанров с сервера
    // fetch('/api/genres', {...})
    //   .then(data => { ... })
}

function editTrack(trackId) {
    // В реальном приложении реализовать редактирование трека
    alert(`Редактирование трека с ID: ${trackId}`);
}

function deleteTrack(trackId, isAdmin = false) {
    if (confirm('Вы уверены, что хотите удалить этот трек?')) {
        fetch(`/api/tracks/${trackId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert('Трек успешно удален');
                // Перезагружаем соответствующую вкладку
                if (isAdmin) {
                    loadAllTracksData();
                } else {
                    loadTracksData();
                }
            } else {
                alert(data.error || 'Ошибка удаления трека');
            }
        })
        .catch(error => {
            console.error('Ошибка удаления трека:', error);
            alert('Ошибка при удалении трека');
        });
    }
}

function viewCollection(collectionId) {
    // В реальном приложении открыть модальное окно или новую страницу с коллекцией
    alert(`Просмотр коллекции с ID: ${collectionId}`);
}
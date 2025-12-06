// Общие JavaScript функции для музыкальной библиотеки

// Функция для форматирования продолжительности в формате HH:MM:SS или MM:SS
function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Функция для получения CSRF-токена из куки (если используется)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Общая функция для отправки запросов с обработкой ошибок
function makeRequest(url, method = 'GET', data = null) {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        config.body = JSON.stringify(data);
    }
    
    return fetch(url, config)
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Произошла ошибка при выполнении запроса');
                });
            }
            return response.json();
        });
}

// Функция для выхода из системы
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        window.location.href = '/';
    })
    .catch(error => {
        console.error('Ошибка при выходе:', error);
        // Даже если запрос не удался, перенаправляем на главную
        window.location.href = '/';
    });
}

// Инициализация общих обработчиков событий
document.addEventListener('DOMContentLoaded', function() {
    // Обработчик для кнопки выхода (если есть на странице)
    const logoutBtn = document.querySelector('#logout-btn, .logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Обработчик для ссылок навигации, чтобы предотвратить переход при отсутствии прав
    document.querySelectorAll('a[data-role]').forEach(link => {
        link.addEventListener('click', function(e) {
            const requiredRole = this.getAttribute('data-role');
            const currentUserRole = document.body.getAttribute('data-user-role');
            
            if (requiredRole === 'admin' && currentUserRole !== 'admin') {
                e.preventDefault();
                alert('У вас нет прав для доступа к этой странице');
            }
        });
    });
});
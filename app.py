from flask import Flask, request, jsonify, session, render_template, redirect
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key_for_development')

# Database connection configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'music_library'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'postgres'),
    'port': os.environ.get('DB_PORT', 5432)
}

def get_db_connection():
    """Establish a connection to the PostgreSQL database"""
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

def login_required(f):
    """Decorator to require login for certain routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Требуется авторизация'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator to require admin privileges"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Требуется авторизация'}), 401
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT role FROM \"user\" WHERE user_id = %s", (session['user_id'],))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user['role'] != 'admin':
            return jsonify({'error': 'Требуются права администратора'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    login = data.get('login')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    
    if not login or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if user already exists
        cur.execute("SELECT user_id FROM \"user\" WHERE login = %s", (login,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
        
        # Hash the password
        password_hash = generate_password_hash(password)
        
        # Call stored procedure to add user
        cur.execute(
            "SELECT add_user(%s, %s, %s, %s, %s)",
            (login, password_hash, first_name, last_name, email)
        )
        new_user_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Пользователь успешно зарегистрирован', 'user_id': new_user_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login a user"""
    data = request.json
    login = data.get('login')
    password = data.get('password')
    
    if not login or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT user_id, login, password_hash, role FROM \"user\" WHERE login = %s", (login,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['user_id']
            session['login'] = user['login']
            session['role'] = user['role']
            return jsonify({
                'message': 'Успешный вход',
                'user_id': user['user_id'],
                'login': user['login'],
                'role': user['role']
            }), 200
        else:
            return jsonify({'error': 'Неверный логин или пароль'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    """Logout a user"""
    session.clear()
    return jsonify({'message': 'Выход выполнен успешно'}), 200

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    """Get user profile"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT * FROM get_user_profile(%s)", (session['user_id'],))
        profile = cur.fetchone()
        cur.close()
        conn.close()
        
        if profile:
            return jsonify(dict(profile)), 200
        else:
            return jsonify({'error': 'Профиль не найден'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile"""
    data = request.json
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    avatar_url = data.get('avatar_url')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "SELECT update_user_profile(%s, %s, %s, %s, %s)",
            (session['user_id'], first_name, last_name, email, avatar_url)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Профиль успешно обновлен'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks', methods=['GET'])
@login_required
def get_tracks():
    """Get user's tracks or all tracks (admin only)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if user is admin
        cur.execute("SELECT role FROM \"user\" WHERE user_id = %s", (session['user_id'],))
        user_role = cur.fetchone()['role']
        
        if user_role == 'admin':
            cur.execute("SELECT * FROM get_all_tracks(%s)", (session['user_id'],))
        else:
            cur.execute("SELECT * FROM get_user_tracks(%s)", (session['user_id'],))
        
        tracks = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'tracks': tracks}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks', methods=['POST'])
@login_required
def add_track():
    """Add a new track"""
    data = request.json
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    if not title or not artist_id or not genre_id:
        return jsonify({'error': 'Название, исполнитель и жанр обязательны'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "SELECT add_track(%s, %s, %s, %s, %s, %s)",
            (title, artist_id, genre_id, bpm, duration_sec, session['user_id'])
        )
        new_track_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Трек успешно добавлен', 'track_id': new_track_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks/<int:track_id>', methods=['PUT'])
@login_required
def update_track(track_id):
    """Update a track"""
    data = request.json
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "SELECT update_track(%s, %s, %s, %s, %s, %s, %s)",
            (track_id, session['user_id'], title, artist_id, genre_id, bpm, duration_sec)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Трек успешно обновлен'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks/<int:track_id>', methods=['DELETE'])
@login_required
def delete_track(track_id):
    """Delete a track"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT delete_track(%s, %s)", (track_id, session['user_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Трек успешно удален'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks/search', methods=['POST'])
@login_required
def search_tracks():
    """Search tracks by criteria"""
    data = request.json
    title = data.get('title')
    artist_name = data.get('artist_name')
    genre_name = data.get('genre_name')
    min_bpm = data.get('min_bpm')
    max_bpm = data.get('max_bpm')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            "SELECT * FROM search_tracks(%s, %s, %s, %s, %s, %s)",
            (title, artist_name, genre_name, min_bpm, max_bpm, session['user_id'])
        )
        tracks = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'tracks': tracks}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/artists', methods=['POST'])
@login_required
def add_artist():
    """Add a new artist"""
    data = request.json
    name = data.get('name')
    
    if not name:
        return jsonify({'error': 'Имя исполнителя обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_artist(%s)", (name,))
        new_artist_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Исполнитель успешно добавлен', 'artist_id': new_artist_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/genres', methods=['POST'])
@login_required
def add_genre():
    """Add a new genre"""
    data = request.json
    name = data.get('name')
    
    if not name:
        return jsonify({'error': 'Название жанра обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_genre(%s)", (name,))
        new_genre_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Жанр успешно добавлен', 'genre_id': new_genre_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collections', methods=['GET'])
@login_required
def get_collections():
    """Get user's collections"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT * FROM get_user_collections(%s)", (session['user_id'],))
        collections = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'collections': collections}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collections', methods=['POST'])
@login_required
def add_collection():
    """Add a new collection"""
    data = request.json
    name = data.get('name')
    is_favorite = data.get('is_favorite', False)
    
    if not name:
        return jsonify({'error': 'Название коллекции обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_collection(%s, %s, %s)", (session['user_id'], name, is_favorite))
        new_collection_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Коллекция успешно добавлена', 'collection_id': new_collection_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collections/<int:collection_id>/tracks', methods=['GET'])
@login_required
def get_collection_tracks(collection_id):
    """Get tracks in a collection"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT * FROM get_collection_tracks(%s, %s)", (collection_id, session['user_id']))
        tracks = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'tracks': tracks}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collections/<int:collection_id>/tracks', methods=['POST'])
@login_required
def add_track_to_collection(collection_id):
    """Add a track to a collection"""
    data = request.json
    track_id = data.get('track_id')
    
    if not track_id:
        return jsonify({'error': 'ID трека обязателен'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_track_to_collection(%s, %s)", (collection_id, track_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Трек успешно добавлен в коллекцию'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/favorite_genres', methods=['POST'])
@login_required
def add_favorite_genre():
    """Add a favorite genre"""
    data = request.json
    genre_id = data.get('genre_id')
    
    if not genre_id:
        return jsonify({'error': 'ID жанра обязателен'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_favorite_genre(%s, %s)", (session['user_id'], genre_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Любимый жанр успешно добавлен'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/favorite_artists', methods=['POST'])
@login_required
def add_favorite_artist():
    """Add a favorite artist"""
    data = request.json
    artist_id = data.get('artist_id')
    
    if not artist_id:
        return jsonify({'error': 'ID исполнителя обязателен'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT add_favorite_artist(%s, %s)", (session['user_id'], artist_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Любимый исполнитель успешно добавлен'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audit', methods=['GET'])
@admin_required
def get_audit_log():
    """Get audit log (admin only)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT * FROM get_audit_log(%s)", (session['user_id'],))
        audit_log = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'audit_log': audit_log}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout')
@login_required
def logout_page():
    """Logout page - clears session and redirects to main page"""
    session.clear()
    return redirect('/')

# Routes for HTML pages
@app.route('/')
def index():
    """Main page"""
    if 'user_id' not in session:
        return render_template('index.html')
    # Redirect authenticated users to dashboard
    return redirect('/tracks')

@app.route('/profile')
@login_required
def profile():
    """User profile page"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user profile
        cur.execute("SELECT * FROM get_user_profile(%s)", (session['user_id'],))
        user = cur.fetchone()
        
        # Get favorite genres
        cur.execute("""
            SELECT g.name 
            FROM user_favorite_genres ufg 
            JOIN genres g ON ufg.genre_id = g.genre_id 
            WHERE ufg.user_id = %s
        """, (session['user_id'],))
        favorite_genres = cur.fetchall()
        
        # Get favorite artists
        cur.execute("""
            SELECT a.name 
            FROM user_favorite_artists ufa 
            JOIN artists a ON ufa.artist_id = a.artist_id 
            WHERE ufa.user_id = %s
        """, (session['user_id'],))
        favorite_artists = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return render_template('profile.html', user=user, favorite_genres=favorite_genres, favorite_artists=favorite_artists)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/tracks')
@login_required
def tracks():
    """Tracks page"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if user is admin
        cur.execute("SELECT role FROM \"user\" WHERE user_id = %s", (session['user_id'],))
        user_role = cur.fetchone()['role']
        
        if user_role == 'admin':
            cur.execute("SELECT * FROM get_all_tracks(%s)", (session['user_id'],))
        else:
            cur.execute("SELECT * FROM get_user_tracks(%s)", (session['user_id'],))
        tracks = cur.fetchall()
        
        # Get all genres for filter
        cur.execute("SELECT genre_id, name FROM genres ORDER BY name")
        genres = cur.fetchall()
        
        # Get all artists for filter
        cur.execute("SELECT artist_id, name FROM artists ORDER BY name")
        artists = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # Helper function to format duration
        def format_duration(seconds):
            if seconds is None:
                return 'N/A'
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            if hours > 0:
                return f"{hours:02d}:{minutes:02d}:{secs:02d}"
            else:
                return f"{minutes:02d}:{secs:02d}"
        
        return render_template('tracks.html', tracks=tracks, genres=genres, artists=artists, format_duration=format_duration)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/collections')
@login_required
def collections():
    """Collections page"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user collections
        cur.execute("SELECT * FROM get_user_collections(%s)", (session['user_id'],))
        collections = cur.fetchall()
        
        # For each collection, get its tracks
        for collection in collections:
            cur.execute("SELECT * FROM get_collection_tracks(%s, %s)", (collection['collection_id'], session['user_id']))
            collection['tracks'] = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return render_template('collections.html', collections=collections)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin')
@admin_required
def admin_panel():
    """Admin panel page"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all tracks
        cur.execute("SELECT * FROM get_all_tracks(%s)", (session['user_id'],))
        tracks = cur.fetchall()
        
        # Get all users
        cur.execute("SELECT user_id, login, first_name, last_name, email, created_at FROM \"user\" ORDER BY created_at")
        users = cur.fetchall()
        
        # Get audit log
        cur.execute("SELECT * FROM get_audit_log(%s)", (session['user_id'],))
        audit_log = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return render_template('admin.html', tracks=tracks, users=users, audit_log=audit_log)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
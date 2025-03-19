# ==========================================================
 # Case Management System - Main Application Entry Point
 # 
 # This Flask application serves as the backend for a comprehensive 
 # case management system with user authentication and role-based access.
 # 
 # Key Features:
 #   - Firebase Authentication
 #   - Case Creation and Management
 #   - Admin User Management
 # 
 # Deployment: Docker container with port 8080 accessible
 # ==========================================================

# Standard library imports
import os
import json
from datetime import datetime, timedelta

# Third-party library imports
import firebase_admin
from firebase_admin import credentials, auth, firestore
from flask import Flask, render_template, redirect, url_for, session, flash, request, jsonify

# Firebase and Application Configuration
def initialize_firebase_config():
    """
    Initialize Firebase configuration and credentials.
    
    Returns:
        tuple: Firestore client and Firebase configuration
    """
    # Load Firebase configuration from environment variables
    firebase_config = json.loads(os.environ['FIREBASE_CONFIG'])
    cred = credentials.Certificate(firebase_config)
    firebase_admin.initialize_app(cred)
    
    # Initialize Firestore client for database operations
    db = firestore.client()
    
    return db, firebase_config

# Initialize Firebase and database
db, firebase_config = initialize_firebase_config()

# Flask Application Setup
app = Flask(__name__, static_folder='static')

# Configure session and security settings
app.config['SECRET_KEY'] = os.urandom(24)  # Generate a random secret key for session security
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)  # Set session lifetime
app.config['SESSION_PERMANENT'] = True  # Enable permanent sessions

def verify_firebase_token():
    """
    Verify the Firebase authentication token for the current user session.

    Returns:
        Redirect to login page if no valid user session exists.
    """
    if 'user' not in session:
        return redirect(url_for('login'))
    return None

@app.before_request
def auth_middleware():
    """
    Middleware to handle authentication for routes.
    
    Key Responsibilities:
    - Allow public routes to bypass authentication
    - Set session as permanent for consistent user experience
    - Verify user authentication for protected routes
    """
    # Public routes that don't require authentication
    public_routes = ['login', 'handle_login', 'static']
    if request.endpoint in public_routes:
        return
    
    # Set session to permanent to enable 12-hour duration
    session.permanent = True
    return verify_firebase_token()

@app.route('/')
def home():
    """
    Root route that renders the home page.
    
    Returns:
        Rendered home template with cases and Firebase configuration
    """
    # Initialize cases as an empty list
    cases = []
    
    try:
        # Attempt to fetch cases from Firestore
        if 'user' in session:
            user_id = session['user']['id']
            cases_ref = db.collection('cases').where('user_id', '==', user_id)
            cases_docs = cases_ref.stream()
            
            # Convert Firestore documents to list of dictionaries
            cases = [
                {
                    'id': doc.id, 
                    'title': doc.to_dict().get('title', 'Untitled Case'),
                    'priority': doc.to_dict().get('priority', 'Unknown'),
                    'status': doc.to_dict().get('status', 'Pending'),
                    'created_at': doc.to_dict().get('created_at', datetime.utcnow().isoformat()),
                    'updated_at': doc.to_dict().get('updated_at'),
                    'description': doc.to_dict().get('description', '')
                } for doc in cases_docs
            ]
    except Exception as e:
        # Log the error and keep cases as an empty list
        print(f"Error fetching cases: {str(e)}")
    
    # Prepare safe Firebase configuration for client-side use
    safe_firebase_config = {
        'projectId': firebase_config.get('project_id'),
        'authDomain': f"{firebase_config.get('project_id')}.firebaseapp.com",
        'storageBucket': f"{firebase_config.get('project_id')}.appspot.com"
    }
    
    return render_template('home.html', 
                           cases=cases, 
                           firebase_config=safe_firebase_config,
                           firebase_web_api_key=os.environ['FIREBASE_WEB_API_KEY'])

@app.route('/login', methods=['GET'])
def login():
    """
    Render login page with Firebase configuration.
    
    Key Actions:
    - Redirect to home if user is already logged in
    - Prepare safe Firebase configuration for client-side use
    
    Returns:
        Rendered login template or redirect to home page
    """
    if 'user' in session:
        return redirect(url_for('home'))
    
    # Remove sensitive information before passing to template
    safe_firebase_config = {
        'projectId': firebase_config.get('project_id'),
        'authDomain': f"{firebase_config.get('project_id')}.firebaseapp.com",
        'storageBucket': f"{firebase_config.get('project_id')}.appspot.com"
    }
    
    return render_template('login.html', 
                          firebase_config=safe_firebase_config,
                          firebase_web_api_key=os.environ['FIREBASE_WEB_API_KEY'])

@app.route('/handle-login', methods=['POST'])
def handle_login():
    """
    Handle user login via Firebase authentication.
    
    Key Actions:
    - Verify Firebase ID token
    - Create user in Firestore if not exists
    - Store user session information
    
    Returns:
        JSON response indicating login success or failure
    """
    try:
        id_token = request.json['idToken']
        # Verify the ID token
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token['email']

        # Check if user exists in Firestore, if not create them
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            user_data = {
                'email': email,
                'created_at': datetime.utcnow(),
                'display_name': decoded_token.get('name', '')
            }
            user_ref.set(user_data)

        # Store user info in session
        session['user'] = {
            'id': uid,
            'email': email
        }
        
        return {'status': 'success'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 400
@app.route('/add-case-update', methods=['POST'])
def add_case_update():
    """
    Add a progress update to a case.
    
    Returns:
        JSON response indicating success or failure
    """
    try:
        update_data = request.get_json()
        case_id = update_data['case_id']
        
        # Add user info and timestamp
        update_data['user_email'] = session['user']['email']
        update_data['timestamp'] = datetime.utcnow().isoformat()
        
        # Store update in Firestore
        updates_ref = db.collection('case_updates').document()
        updates_ref.set(update_data)
        
        # Update case status if provided
        if update_data.get('new_status'):
            case_ref = db.collection('cases').document(case_id)
            case_ref.update({
                'status': update_data['new_status'],
                'updated_at': datetime.utcnow().isoformat()
            })
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/get-case-updates/<case_id>')
def get_case_updates(case_id):
    """
    Get all progress updates for a case.
    
    Args:
        case_id (str): ID of the case
    
    Returns:
        JSON response containing updates
    """
    try:
        # Create a composite index for this query in Firestore
        updates_ref = db.collection('case_updates')
        updates_query = updates_ref.where('case_id', '==', case_id).order_by('timestamp', direction=firestore.Query.DESCENDING)
        updates_docs = updates_query.stream()
        
        updates_list = []
        for update in updates_docs:
            update_dict = update.to_dict()
            updates_list.append({
                'text': update_dict.get('text', ''),
                'timestamp': update_dict.get('timestamp', ''),
                'user_email': update_dict.get('user_email', ''),
                'new_status': update_dict.get('new_status')
            })
        
        print(f"Fetched {len(updates_list)} updates for case {case_id}")  # Debug print
        
        return jsonify({'status': 'success', 'updates': updates_list})
    except Exception as e:
        print(f"Error fetching case updates: {str(e)}")  # Debug print
        return jsonify({'status': 'error', 'message': 'Please create a Firestore composite index for this query. Visit Firebase Console to create the index.'}), 400
@app.route('/create-case', methods=['POST'])
def create_case():
    """
    Create a new case based on the provided data.
    
    Key Actions:
    - Validate case data
    - Store case in database
    
    Returns:
        JSON response indicating case creation success or failure
    """
    try:
        case_data = request.get_json()
        user_id = session['user']['id']
        
        # Add user_id and timestamps
        case_data['user_id'] = user_id
        case_data['created_at'] = datetime.utcnow().isoformat()
        case_data['updated_at'] = datetime.utcnow().isoformat()
        
        # Store in Firestore
        doc_ref = db.collection('cases').document()
        doc_ref.set(case_data)
        
        # Add document ID to response
        case_data['id'] = doc_ref.id
        
        return jsonify({'status': 'success', 'case': case_data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/get-cases', methods=['GET'])
def get_cases():
    """
    Retrieve cases from the database.
    
    Key Actions:
    - Fetch cases for the current user
    
    Returns:
        JSON response containing a list of cases
    """
    try:
        if 'user' not in session:
            return jsonify({'status': 'error', 'message': 'Not authenticated'}), 401
            
        user_id = session['user']['id']
        cases_ref = db.collection('cases').where('user_id', '==', user_id)
        cases_docs = cases_ref.stream()
        
        cases = [
            {
                'id': doc.id,
                'title': doc.to_dict().get('title', 'Untitled Case'),
                'priority': doc.to_dict().get('priority', 'Unknown'),
                'status': doc.to_dict().get('status', 'Pending'),
                'created_at': doc.to_dict().get('created_at', datetime.utcnow().isoformat()),
                'updated_at': doc.to_dict().get('updated_at'),
                'description': doc.to_dict().get('description', '')
            } for doc in cases_docs
        ]
        
        return jsonify({'status': 'success', 'cases': cases})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
@app.route('/update-case/<case_id>', methods=['PATCH'])
def update_case(case_id):
    """
    Update an existing case with the provided data.
    
    Args:
        case_id (str): ID of the case to update
    
    Returns:
        JSON response indicating the result of the update
    """
    try:
        case_data = request.get_json()
        # TODO: Implement actual case update in Firestore
        return jsonify({'status': 'success', 'updated_case': {'id': case_id, **case_data}})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/admin/create-user', methods=['POST'])
def admin_create_user():
    """
    Create a new user from the admin panel.
    
    Key Actions:
    - Validate user data
    - Create user in Firestore
    
    Returns:
        JSON response indicating the result of user creation
    """
    try:
        user_data = request.get_json()
        # TODO: Implement actual user creation in Firestore
        return jsonify({'status': 'success', 'user': user_data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/admin_panel', methods=['GET'])
def admin_panel():
  """
  Render the admin panel for user management.
  
  Returns:
      Rendered admin panel HTML template with users data
  """
  users = []
  try:
      # Fetch users from Firestore
      users_ref = db.collection('users').stream()
      users = [
          {
              'id': doc.id,
              'display_name': doc.to_dict().get('display_name', ''),
              'email': doc.to_dict().get('email', ''),
              'role': doc.to_dict().get('role', 'Unassigned'),
              'last_login': doc.to_dict().get('last_login')
          } for doc in users_ref
      ]
  except Exception as e:
      print(f"Error fetching users: {str(e)}")
  
  return render_template('admin.html', users=users)

# Main initialization block
if __name__ == "__main__":
    """
    Main entry point for the Flask application.
    Runs the app on host 0.0.0.0 and port 8080.
    """
    app.run(host="0.0.0.0", port=8080, debug=True)
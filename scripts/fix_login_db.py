import sqlite3

def fix_db():
    try:
        conn = sqlite3.connect('data/db/trabajadores.db')
        cursor = conn.cursor()
        
        # Update admin password to 'admin'
        # Generated hash: $2b$12$/vrezYntfYLV8w0atxefQuoHXdrsb8xQNHwWQbpl5qw2yg2AHBXbC
        cursor.execute("UPDATE trabajadores SET password_hash='$2b$12$/vrezYntfYLV8w0atxefQuoHXdrsb8xQNHwWQbpl5qw2yg2AHBXbC' WHERE usuario='admin'")
        
        # Ensure 'empleado' user exists with password 'empleado123'
        # Generated hash: $2b$12$D9Y.8.NFES9Bo8Myd33myO9cJoFqC.x8xpEXJSHVfvtxpyMHgQYoq
        cursor.execute("""
        INSERT INTO trabajadores (usuario, password_hash, nombre, apellido, activo)
        SELECT 'empleado', '$2b$12$D9Y.8.NFES9Bo8Myd33myO9cJoFqC.x8xpEXJSHVfvtxpyMHgQYoq', 'Prueba', 'Empleado', 1
        WHERE NOT EXISTS (SELECT 1 FROM trabajadores WHERE usuario = 'empleado')
        """)
        
        # If it already existed, update its password
        cursor.execute("UPDATE trabajadores SET password_hash='$2b$12$D9Y.8.NFES9Bo8Myd33myO9cJoFqC.x8xpEXJSHVfvtxpyMHgQYoq' WHERE usuario='empleado'")
        
        conn.commit()
        print("✅ Database updated successfully")
        conn.close()
    except Exception as e:
        print(f"❌ Error updating database: {e}")

if __name__ == "__main__":
    fix_db()

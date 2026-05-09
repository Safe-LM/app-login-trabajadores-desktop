import sqlite3
import bcrypt


def fix_db():
    conn = sqlite3.connect("data/db/trabajadores.db")
    cursor = conn.cursor()

    # admin / admin123
    admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
    cursor.execute(
        "UPDATE trabajadores SET password_hash=? WHERE usuario='admin'", (admin_hash,)
    )

    # empleado / empleado123
    emp_hash = bcrypt.hashpw(b"empleado123", bcrypt.gensalt()).decode()
    cursor.execute(
        "UPDATE trabajadores SET password_hash=? WHERE usuario='empleado'", (emp_hash,)
    )

    conn.commit()
    print(f"✅ admin -> admin123")
    print(f"✅ empleado -> empleado123")
    conn.close()


if __name__ == "__main__":
    fix_db()

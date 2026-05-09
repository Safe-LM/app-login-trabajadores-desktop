import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "station" / "src"))
from utils.supabase_client import get_supabase_client

sb = get_supabase_client()
data = sb.table("empleados").select("id").execute().data
print(f"Total empleados en Supabase: {len(data)}")

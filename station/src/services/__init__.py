"""
Services layer — business logic orchestration.

Exports:
    - attendance_service: register_local, sync_to_supabase, flush_offline_queue, etc.
    - dto: RecognitionResult, AttendanceRecord, StationHealth, RecentActivity
"""
from services.dto import RecognitionResult, AttendanceRecord, StationHealth, RecentActivity

__all__ = ["RecognitionResult", "AttendanceRecord", "StationHealth", "RecentActivity"]

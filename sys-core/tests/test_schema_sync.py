import pytest
from api.models import LessonPlan
from api.schemas import LessonPlanResponse

def test_lessonplan_schema_sync():
    """
    Architect Recommendation: Ensure Pydantic schemas are in sync with SQLAlchemy models.
    This test prevents runtime errors when DB structure changes but API schemas don't.
    """
    model_columns = LessonPlan.__table__.columns.keys()
    schema_fields = LessonPlanResponse.model_fields.keys()
    
    # Check that all model columns exist in the response schema 
    # (or at least the ones we expect to expose)
    for col in model_columns:
        assert col in schema_fields, f"Column '{col}' found in Model but missing in Pydantic Schema"

    print("✅ Schema synchronization verified.")

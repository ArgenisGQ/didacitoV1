from django.urls import path
from . import views

urlpatterns = [
    path('ingest/<int:subject_id>/', views.ingest_syllabus, name='ingest_syllabus'),
    path('evaluate/<int:plan_id>/', views.evaluate_plan, name='evaluate_plan'),
    path('evaluation/<int:plan_id>/', views.get_evaluation, name='get_evaluation'),
    path('admin/rag-status/', views.rag_status, name='rag_status'),
    path('admin/sync-all/', views.sync_all_syllabuses, name='sync_all_syllabuses'),
    path('admin/providers', views.admin_providers, name='admin_providers'),
    path('admin/providers/<int:provider_id>', views.admin_providers_detail, name='admin_providers_detail'),
    path('admin/templates', views.admin_templates, name='admin_templates'),
    path('admin/templates/<int:template_id>', views.admin_templates_detail, name='admin_templates_detail'),
    path('admin/rag-logs/', views.rag_logs, name='rag_logs'),
    path('admin/test-provider/', views.test_provider_connection, name='test_provider_connection'),
    path('admin/chat-rag/', views.chat_rag, name='chat_rag'),
]

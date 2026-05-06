from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Catalog, Parameter, LessonPlan,
    EvaluationPlan, WeeklyContent
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "full_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Informacion Personal", {"fields": ("full_name", "role")}),
        (
            "Permisos",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "role", "password1", "password2"),
            },
        ),
    )


@admin.register(Catalog)
class CatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("name",)


@admin.register(Parameter)
class ParameterAdmin(admin.ModelAdmin):
    list_display = ("hd_hours", "hiv_hours", "hde_hours", "valid_from")


class EvaluationPlanInline(admin.TabularInline):
    model = EvaluationPlan
    extra = 0
    fields = ("unit", "competence", "strategy", "instrument", "weight", "due_week")


class WeeklyContentInline(admin.TabularInline):
    model = WeeklyContent
    extra = 0
    fields = ("week_number", "content_description", "teaching_strategy")


@admin.register(LessonPlan)
class LessonPlanAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "status", "coordinator", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "author__email", "author__full_name")
    inlines = [EvaluationPlanInline, WeeklyContentInline]
    raw_id_fields = ("author", "program", "coordinator")


@admin.register(EvaluationPlan)
class EvaluationPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "lesson_plan", "competence", "weight", "due_week")
    list_filter = ("lesson_plan__status",)


@admin.register(WeeklyContent)
class WeeklyContentAdmin(admin.ModelAdmin):
    list_display = ("id", "lesson_plan", "week_number")
    list_filter = ("week_number",)

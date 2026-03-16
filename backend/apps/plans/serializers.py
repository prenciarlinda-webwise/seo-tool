from rest_framework import serializers

from .models import Deliverable, PlanItem, QuarterlyPlan


class DeliverableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deliverable
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class PlanItemSerializer(serializers.ModelSerializer):
    current_rank = serializers.IntegerField(read_only=True)
    rank_improvement = serializers.IntegerField(read_only=True)
    is_target_achieved = serializers.BooleanField(read_only=True)
    deliverables_done = serializers.CharField(read_only=True)
    deliverables = DeliverableSerializer(many=True, read_only=True)

    class Meta:
        model = PlanItem
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class QuarterlyPlanSerializer(serializers.ModelSerializer):
    items = PlanItemSerializer(many=True, read_only=True)
    progress_pct = serializers.IntegerField(read_only=True)
    items_count = serializers.SerializerMethodField()
    achieved_count = serializers.SerializerMethodField()
    category_summary = serializers.SerializerMethodField()

    class Meta:
        model = QuarterlyPlan
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_achieved_count(self, obj):
        return sum(1 for i in obj.items.all() if i.is_target_achieved)

    def get_category_summary(self, obj):
        from collections import Counter
        counts = Counter(obj.items.values_list("category", flat=True))
        return dict(counts)


class QuarterlyPlanListSerializer(serializers.ModelSerializer):
    progress_pct = serializers.IntegerField(read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = QuarterlyPlan
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def get_items_count(self, obj):
        return obj.items.count()

import csv
import io

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlanItem, QuarterlyPlan


class PlanItemImportView(APIView):
    """
    Import plan items from CSV into an existing plan.

    Expected columns:
    category, keyword_text, target_url, target_rank, title, priority, notes

    category must be one of: on_page, gmb, citations, content, link_building, technical
    """

    parser_classes = [MultiPartParser]

    VALID_CATEGORIES = {"on_page", "gmb", "citations", "content", "link_building", "technical"}

    def post(self, request, client_pk, plan_pk):
        try:
            plan = QuarterlyPlan.objects.get(id=plan_pk, client_id=client_pk)
        except QuarterlyPlan.DoesNotExist:
            return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            content = file.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
        except Exception as e:
            return Response({"error": f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        if not reader.fieldnames:
            return Response({"error": "CSV has no headers."}, status=status.HTTP_400_BAD_REQUEST)

        headers = {h.strip().lower() for h in reader.fieldnames if h}
        if "category" not in headers:
            return Response({"error": "Missing required column: category"}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        errors = []

        for i, row in enumerate(reader, start=2):
            row = {
                (k.strip().lower() if k else ""): (v.strip() if v else "")
                for k, v in row.items()
                if k
            }

            category = row.get("category", "").strip()
            if category not in self.VALID_CATEGORIES:
                errors.append(f"Row {i}: invalid category '{category}'")
                continue

            # Try to link to existing keyword
            keyword = None
            keyword_text = row.get("keyword_text", "").strip()
            if keyword_text:
                from apps.keywords.models import Keyword
                keyword = Keyword.objects.filter(
                    client_id=client_pk, keyword_text=keyword_text,
                ).first()

            try:
                target_rank = int(row["target_rank"]) if row.get("target_rank") else None
            except ValueError:
                target_rank = None

            try:
                priority = int(row["priority"]) if row.get("priority") else 0
            except ValueError:
                priority = 0

            PlanItem.objects.create(
                plan=plan,
                category=category,
                keyword=keyword,
                keyword_text=keyword_text,
                target_url=row.get("target_url", ""),
                target_rank=target_rank,
                title=row.get("title", ""),
                priority=priority,
                notes=row.get("notes", ""),
                # Category-specific fields
                citation_source=row.get("citation_source", ""),
                citation_status=row.get("citation_status", ""),
                content_title=row.get("content_title", "") or row.get("title", ""),
                content_status=row.get("content_status", ""),
                link_target_domain=row.get("link_target_domain", ""),
                link_status=row.get("link_status", ""),
                month_0_rank=int(row["month_0_rank"]) if row.get("month_0_rank") else None,
            )
            created += 1

        return Response({
            "created": created,
            "errors": errors,
            "plan": plan.name,
        })


class PlanItemExportView(APIView):
    """Export plan items as CSV."""

    def get(self, request, client_pk, plan_pk):
        from django.http import HttpResponse

        try:
            plan = QuarterlyPlan.objects.get(id=plan_pk, client_id=client_pk)
        except QuarterlyPlan.DoesNotExist:
            return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="plan_{plan.id}_items.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "category", "keyword_text", "target_url", "target_rank", "title",
            "priority", "month_0_rank", "month_1_rank", "month_2_rank", "month_3_rank",
            "is_completed", "citation_source", "content_title", "content_status",
            "link_target_domain", "link_status", "notes",
        ])

        for item in plan.items.all():
            writer.writerow([
                item.category, item.keyword_text, item.target_url, item.target_rank or "",
                item.title, item.priority,
                item.month_0_rank or "", item.month_1_rank or "",
                item.month_2_rank or "", item.month_3_rank or "",
                item.is_completed,
                item.citation_source, item.content_title, item.content_status,
                item.link_target_domain, item.link_status, item.notes,
            ])

        return response

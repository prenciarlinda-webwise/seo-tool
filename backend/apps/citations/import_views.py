import csv
import io

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Citation, CitationDirectory


class CitationImportView(APIView):
    """
    Import citation directories for a client from CSV.
    The API will auto-check NAP via the check_citations task.

    Expected columns:
    directory_name, directory_url (optional), listing_url (optional)

    After import, triggers the citation checker task.
    """

    parser_classes = [MultiPartParser]

    def post(self, request, client_pk):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"error": "No file provided. Upload a CSV file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content = file.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
        except Exception as e:
            return Response(
                {"error": f"Failed to parse CSV: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reader.fieldnames:
            return Response(
                {"error": "CSV has no headers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = {h.strip().lower() for h in reader.fieldnames}
        if "directory_name" not in headers:
            return Response(
                {"error": "Missing required column: directory_name"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        skipped = 0
        errors = []

        for i, row in enumerate(reader, start=2):
            row = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items()}

            dir_name = row.get("directory_name", "").strip()
            if not dir_name:
                errors.append(f"Row {i}: directory_name is required")
                continue

            # Get or create the directory
            dir_url = row.get("directory_url", "").strip()
            directory, _ = CitationDirectory.objects.get_or_create(
                name=dir_name,
                defaults={"url": dir_url} if dir_url else {},
            )

            # Create citation if not exists
            citation, was_created = Citation.objects.get_or_create(
                client_id=client_pk,
                directory=directory,
                defaults={
                    "listing_url": row.get("listing_url", ""),
                    "status": "not_found",  # Will be updated by auto-checker
                },
            )

            if was_created:
                created += 1
            else:
                # Update listing URL if provided
                if row.get("listing_url") and not citation.listing_url:
                    citation.listing_url = row["listing_url"]
                    citation.save(update_fields=["listing_url"])
                skipped += 1

        # Trigger auto-check
        from apps.citations.tasks import check_citations_for_client
        check_citations_for_client.delay(client_pk)

        return Response({
            "created": created,
            "skipped": skipped,
            "errors": errors,
            "message": "Citations imported. Auto-check has been triggered.",
        })


class CitationExportView(APIView):
    """Export citations for a client as CSV."""

    def get(self, request, client_pk):
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="citations.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "directory_name", "directory_url", "status", "listing_url",
            "listed_name", "listed_address", "listed_phone", "listed_zip",
            "name_accurate", "address_accurate", "phone_accurate", "zip_accurate",
            "last_checked_at",
        ])

        for c in Citation.objects.filter(client_id=client_pk).select_related("directory"):
            writer.writerow([
                c.directory.name, c.directory.url, c.status, c.listing_url,
                c.listed_name, c.listed_address, c.listed_phone, c.listed_zip,
                c.name_accurate, c.address_accurate, c.phone_accurate, c.zip_accurate,
                c.last_checked_at,
            ])

        return response

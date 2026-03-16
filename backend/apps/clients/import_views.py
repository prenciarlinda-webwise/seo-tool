import csv
import io

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Client


class ClientImportView(APIView):
    """
    Import clients from CSV.

    Expected columns (order matters, headers required):
    name, domain, website_url, business_type, contact_name, contact_email,
    contact_phone, address, city, state, zip_code, country,
    google_business_name, google_place_id
    """

    parser_classes = [MultiPartParser]

    REQUIRED_COLUMNS = {"name", "domain"}
    ALL_COLUMNS = {
        "name", "domain", "website_url", "business_type",
        "contact_name", "contact_email", "contact_phone",
        "address", "city", "state", "zip_code", "country",
        "google_business_name", "google_place_id",
    }

    def post(self, request):
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

        # Validate headers
        if not reader.fieldnames:
            return Response(
                {"error": "CSV has no headers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = self.REQUIRED_COLUMNS - headers
        if missing:
            return Response(
                {"error": f"Missing required columns: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        updated = 0
        errors = []

        for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            row = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items()}

            if not row.get("name") or not row.get("domain"):
                errors.append(f"Row {i}: name and domain are required")
                continue

            defaults = {}
            for col in self.ALL_COLUMNS - {"name", "domain"}:
                if col in row and row[col]:
                    defaults[col] = row[col]

            try:
                _, was_created = Client.objects.update_or_create(
                    domain=row["domain"],
                    defaults={"name": row["name"], **defaults},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")

        return Response({
            "created": created,
            "updated": updated,
            "errors": errors,
            "total_processed": created + updated,
        })


class ClientExportView(APIView):
    """Export all clients as CSV."""

    def get(self, request):
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="clients.csv"'

        writer = csv.writer(response)
        columns = [
            "name", "domain", "website_url", "business_type",
            "contact_name", "contact_email", "contact_phone",
            "address", "city", "state", "zip_code", "country",
            "google_business_name", "google_place_id",
        ]
        writer.writerow(columns)

        for client in Client.objects.all():
            writer.writerow([getattr(client, col, "") for col in columns])

        return response

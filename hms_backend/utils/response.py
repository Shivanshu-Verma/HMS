"""
Helper functions for building consistent success responses.

All success responses follow the shape:
{
    "success": true,
    "data": { ... }
}

Paginated responses additionally include a "meta" key.
"""
from rest_framework.response import Response
from rest_framework import status as http_status


def success_response(data: dict, status: int = http_status.HTTP_200_OK) -> Response:
    """
    Build a standardised success response.

    Args:
        data (dict): The response payload.
        status (int): HTTP status code (default 200).

    Returns:
        Response: DRF Response with the success envelope.
    """
    return Response(
        {
            "success": True,
            "data": data,
        },
        status=status,
    )


def paginated_response(items: list, page: int, page_size: int, total: int, has_next_page: bool) -> Response:
    """
    Build a standardised paginated success response.

    Args:
        items (list): Serialised list of items for the current page.
        page (int): Current page number (1-indexed).
        page_size (int): Number of items per page.
        total (int): Total number of items across all pages.
        has_next_page (bool): Whether more pages exist after the current one.

    Returns:
        Response: DRF Response with the success envelope and pagination meta.
    """
    return Response(
        {
            "success": True,
            "data": {
                "items": items,
            },
            "meta": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "hasNextPage": has_next_page,
            },
        },
        status=http_status.HTTP_200_OK,
    )

"""
Shared pagination utility for HMS list endpoints.

Provides cursor-less page-based pagination. All paginated endpoints return:
{
    "success": true,
    "data": { "items": [...] },
    "meta": { "page": 1, "pageSize": 20, "total": 143, "hasNextPage": true }
}
"""

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def parse_pagination_params(request) -> tuple:
    """
    Extract and validate page and pageSize from query parameters.

    Args:
        request: DRF request object.

    Returns:
        tuple: (page: int, page_size: int) — both guaranteed >= 1,
               page_size capped at MAX_PAGE_SIZE.
    """
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (ValueError, TypeError):
        page = 1

    try:
        page_size = max(1, min(MAX_PAGE_SIZE, int(request.query_params.get('pageSize', DEFAULT_PAGE_SIZE))))
    except (ValueError, TypeError):
        page_size = DEFAULT_PAGE_SIZE

    return page, page_size


def paginate_queryset(queryset, page: int, page_size: int) -> tuple:
    """
    Apply pagination to a MongoEngine queryset.

    Args:
        queryset: MongoEngine QuerySet.
        page (int): 1-indexed page number.
        page_size (int): Number of items per page.

    Returns:
        tuple: (items: list, total: int, has_next_page: bool)
    """
    total = queryset.count()
    skip = (page - 1) * page_size
    items = list(queryset.skip(skip).limit(page_size))
    has_next_page = (skip + page_size) < total

    return items, total, has_next_page

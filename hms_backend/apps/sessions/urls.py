"""URL routes for the sessions app."""
from django.urls import path

app_name = 'sessions'

# Sessions don't have standalone endpoints — they are accessed through
# role-specific apps (consultant, doctor, pharmacy). This file exists
# to satisfy the include() in the root URL config.
urlpatterns = []

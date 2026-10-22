"""Registri adapter sumber. Menambah sumber: buat modul baru turunan Sumber, lalu daftarkan di sini."""

from crawler.inti.kontrak import Sumber

from .arctic_shift import ArcticShift
from .arxiv import Arxiv
from .bluesky import Bluesky
from .google_news import GoogleNews
from .inbox import Inbox
from .kaskus import Kaskus
from .mediakonsumen import MediaKonsumen
from .openalex import OpenAlex
from .playstore import PlayStore
from .reddit import Reddit
from .rss_media import RssMedia
from .stackexchange import StackExchange
from .turnbackhoax import TurnBackHoax
from .web import Web
from .wikipedia import Wikipedia
from .youtube import YouTube


def buat_registri() -> dict[str, Sumber]:
    return {s.id: s for s in (
        GoogleNews(), RssMedia(), TurnBackHoax(), MediaKonsumen(), Reddit(), ArcticShift(), Bluesky(), YouTube(),
        PlayStore(), Kaskus(), OpenAlex(), Arxiv(), Wikipedia(), StackExchange(), Web(), Inbox(),
    )}

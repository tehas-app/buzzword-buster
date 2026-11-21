# The preview of this repository: the game as this commit has it, served as
# static files. `tehasbot preview` builds it for every open pull request.
# Needs no network and no setting; answers HTTP on 8080.
# caddy 2.11.9, named by digest so a moved tag cannot change what runs.
FROM caddy@sha256:0c2243efcf437ab7f7a978f1027fcf0d4f9be8a75df27b1b3fbc5dbe0ffa8cf0
COPY preview/Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/game/index.html
COPY src /srv/game/src
COPY fonts /srv/game/fonts

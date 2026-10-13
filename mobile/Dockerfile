# Application mobile Smart Tontine, version web (mêmes écrans que l'app Android / iPhone), servie par nginx.
# Construite depuis la racine du dépôt (voir docker-compose.yml) pour réutiliser web/security-headers.conf.
FROM node:22-alpine AS build
WORKDIR /app
COPY mobile/package*.json ./
RUN npm ci
COPY mobile/ .
# Adresse de l'API : vide = même domaine (nginx relaie l'API, comme pour la plateforme web).
ARG EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine
COPY mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

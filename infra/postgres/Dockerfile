FROM postgres:15-alpine

ENV POSTGRES_DB=ceip_crm

COPY init.sql /docker-entrypoint-initdb.d/

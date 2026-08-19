@echo off
title Premium Imports LK - Server
cd /d "%~dp0"
echo Starting Premium Imports LK server under PM2 supervision...
call npx pm2 start ecosystem.config.js


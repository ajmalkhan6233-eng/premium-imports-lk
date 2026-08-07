@echo off
title Premium Imports LK - Server
cd /d "%~dp0"
echo Starting Premium Imports LK server...
echo Close this window to stop the server.
node server.js
pause

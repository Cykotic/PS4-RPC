# PS4 RPC

## Overview

PS4 RPC is a Node.js application designed to integrate with Discord to display your current PlayStation 4 game status. Using FTP to access the PS4's file, it fetches the title and details of the currently active game and updates your Discord presence accordingly.

## Features

- Connects to a PlayStation 4 via FTP to retrieve the current game title ID.
- Fetches game details from TMDB and updates your Discord rich presence.
- Supports automatic reconnection and error handling.
- Configurable to either always show presence or only when a game is active.

## Prerequisites

Before you start using this application, ensure you have the following installed:
- Node.js (v12.x or higher recommended)
- npm (usually comes with Node.js)

ip: IP address of your PlayStation 4 with FTP enabled.
clientId: Your Discord application client ID.
TMDB_KEY: Your TMDB API key for fetching game details.
mapped: Initial array to hold game details cache.
presence_on_home: Boolean to control presence updates on the PS4 main menu.
wait_time: Time interval (in seconds) between each check for current game.

# Credits
- [zorua98741]([https://github.com/D5GY](https://github.com/zorua98741))
- Python verison [PS4 RPC](https://github.com/zorua98741/PS4-Rich-Presence-for-Discord)

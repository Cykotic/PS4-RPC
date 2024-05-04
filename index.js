const {
    Client
} = require('discord-rpc');
const fetch = require('node-fetch');
const crypto = require('crypto');
const FtpClient = require('promise-ftp');
const fs = require('fs').promises;

class GamePresenceManager {
    constructor(config) {
        this.rpc = new Client({
            transport: "ipc"
        });
        this.titleId = null;
        this.gameName = null;
        this.gameImage = null;
        this.gameType = null;
        this.config = config;
        this.tmdbKey = Buffer.from(config.TMDB_KEY, 'hex');
    }

    static async loadConfig(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to read configuration from ${filePath}:`, error);
            throw error;
        }
    }

    async checkPS4Connection() {
        const ftp = new FtpClient();
        try {
            await ftp.connect({
                host: this.config.ip,
                port: 2121,
                user: '',
                password: ''
            });
            await ftp.cwd('/mnt/sandbox');
            console.log(`PS4 found on IP: ${this.config.ip}`);
            ftp.end();
            return true;
        } catch (error) {
            console.log(`No PS4 found on IP: ${this.config.ip}. Error: ${error.message}`);
            ftp.end();
            return false;
        }
    }

    async initializeDiscordConnection() {
        try {
            await this.rpc.login({
                clientId: this.config.clientId
            });
            console.log("Connected to Discord client");
        } catch (error) {
            console.error("Discord connection failed: ", error);
            setTimeout(() => this.initializeDiscordConnection(), 20000);
        }
    }

    async saveGameInfo(data) {
        this.config.mapped.push(data);
        await fs.writeFile('./config.json', JSON.stringify(this.config, null, 4));
        console.log('Configuration saved.');
    }

    async fetchPS4TitleId() {
        const ftp = new FtpClient();
        try {
            await ftp.connect({
                host: this.config.ip,
                port: 2121,
                user: '',
                password: ''
            });
            await ftp.cwd('/mnt/sandbox');
            const list = await ftp.list();
            this.titleId = null; // Reset before fetching new ID
            for (let item of list) {
                const match = item.name.match(/^(?!NPXS)([a-zA-Z0-9]{4}[0-9]{5})/);
                if (match) {
                    this.titleId = match[1];
                    break; // Found a valid title ID, break the loop
                }
            }
            ftp.end();
            if (this.titleId === null) {
                this.titleId = "main_menu";
                this.gameImage = this.titleId;
            } else {
                this.identifyGameType();
            }
            console.log(`Title ID: ${this.titleId}, Game Type: ${this.gameType}`);
        } catch (error) {
            console.error('FTP connection failed:', error.message);
            ftp.end();
        }
    }

    identifyGameType() {
        const prefix = this.titleId.substring(0, 4);
        this.gameType = this.config.titleIdDict.PS4.includes(prefix) ? "PS4" : "Homebrew";
    }

    updateGamePresence() {
        this.gameName = null;
        this.gameImage = this.titleId;
        let found = false;
        for (let mapped of this.config.mapped) {
            if (this.titleId === mapped.titleid) {
                this.gameName = mapped.name;
                this.gameImage = mapped.image;
                found = true;
                break;
            }
        }
        if (!found && this.titleId !== "main_menu") {
            if (this.gameType === "PS4") {
                this.fetchPS4GameInfo();
            } else {
                this.fetchOtherGameInfo();
            }
        }
    }

    async fetchPS4GameInfo() {
        const titleId = `${this.titleId}_00`;
        const hmac = crypto.createHmac('sha1', this.tmdbKey);
        hmac.update(titleId);
        const titleIdHash = hmac.digest('hex').toUpperCase();
        const url = `http://tmdb.np.dl.playstation.net/tmdb2/${titleId}_${titleIdHash}/${titleId}.json`;
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });
            if (response.ok) {
                const json = await response.json();
                this.gameName = json.names[0].name;
                this.gameImage = json.icons[0].icon;
                this.saveGameInfo({
                    titleid: this.titleId,
                    name: this.gameName,
                    image: this.gameImage
                });
                console.log(`fetchPS4GameInfo(): ${this.gameName}, ${this.gameImage}`);
            } else {
                console.log(`fetchPS4GameInfo(): No entry found in TMDB for ${this.titleId}`);
                this.gameName = this.titleId;
                this.gameImage = this.titleId.toLowerCase(); // lower case for Discord assets
            }
        } catch (error) {
            console.error(`Error fetching PS4 game info: ${error}`);
        }
    }

    async fetchOtherGameInfo() {
        if (this.titleId !== "main_menu") {
            this.gameName = this.titleId;
            this.gameImage = this.titleId.toLowerCase();
            this.saveGameInfo({
                titleid: this.titleId,
                name: this.gameName,
                image: this.gameImage
            });
            console.log(`fetchOtherGameInfo(): ${this.gameName}, ${this.gameImage}`);
        }
    }
}

async function main() {
    const configData = await GamePresenceManager.loadConfig('./config.json');
    const manager = new GamePresenceManager(configData);
    await manager.initializeDiscordConnection();

    let prevTitleId = "";

    while (true) {
        try {
            await manager.fetchPS4TitleId();

            if (prevTitleId !== manager.titleId) {
                manager.updateGamePresence();
                prevTitleId = manager.titleId;
            }

            if (!manager.config.presence_on_home && manager.titleId === "main_menu") {
                await manager.rpc.clearActivity();
            } else {
                await manager.rpc.setActivity({
                    details: manager.gameName || "Playing a Game",
                    largeImageKey: manager.gameImage || "default_image",
                    largeImageText: manager.titleId || "Playing"
                });
            }

            // console.log('Waiting for the next check interval...');
            await new Promise(resolve => setTimeout(resolve, manager.config.wait_time * 1000));
        } catch (error) {
            console.error(`An error occurred: ${error}`);
            await manager.initializeDiscordConnection();
        }
    }
}

main();
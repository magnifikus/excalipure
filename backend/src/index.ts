import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();
const port = process.env.PORT || 3003;

// Configuration
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, "..", "data");
const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH || path.join(DATA_PATH, "files");

// Ensure directories exist
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}
if (!fs.existsSync(FILE_STORAGE_PATH)) {
  fs.mkdirSync(FILE_STORAGE_PATH, { recursive: true });
}

// Helper: read raw body from request
const readRawBody = (req: Request): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
};

// Helper: JSON file storage for share links
const SHARE_LINKS_FILE = path.join(DATA_PATH, "share_links.json");

interface ShareLink {
  id: string;
  data: string; // base64 encoded
  createdAt: number;
}

const loadShareLinks = (): ShareLink[] => {
  try {
    if (fs.existsSync(SHARE_LINKS_FILE)) {
      return JSON.parse(fs.readFileSync(SHARE_LINKS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading share links:", e);
  }
  return [];
};

const saveShareLinks = (links: ShareLink[]) => {
  fs.writeFileSync(SHARE_LINKS_FILE, JSON.stringify(links, null, 2));
};

// Helper: JSON file storage for scenes
const SCENES_FILE = path.join(DATA_PATH, "scenes.json");

interface Scene {
  roomId: string;
  data: string; // base64 encoded
  updatedAt: number;
}

const loadScenes = (): Scene[] => {
  try {
    if (fs.existsSync(SCENES_FILE)) {
      return JSON.parse(fs.readFileSync(SCENES_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading scenes:", e);
  }
  return [];
};

const saveScenes = (scenes: Scene[]) => {
  fs.writeFileSync(SCENES_FILE, JSON.stringify(scenes, null, 2));
};

// Middleware
app.use(cors());

// Serve static files
app.use("/files", express.static(FILE_STORAGE_PATH));

// Health check
app.get("/", (req, res) => {
  res.send("Excalidraw backend is up :)");
});

// ============ API v2: Shareable Links ============

// POST /api/v2/post - Create shareable link
app.post("/api/v2/post", async (req, res) => {
  try {
    const dataBuffer = await readRawBody(req);
    console.log("POST /api/v2/post - raw body length:", dataBuffer.length);

    const id = uuidv4().replace(/-/g, "").substring(0, 22);
    const createdAt = Date.now();

    // Store as base64 to preserve binary data in JSON
    const links = loadShareLinks();
    links.push({
      id,
      data: dataBuffer.toString("base64"),
      createdAt,
    });
    saveShareLinks(links);

    console.log("POST /api/v2/post - inserted, id:", id);

    res.json({ id });
  } catch (error) {
    console.error("Error creating share link:", error);
    res.status(500).json({ error: "Failed to create share link" });
  }
});

// GET /api/v2/:id - Fetch shareable link data
app.get("/api/v2/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("GET /api/v2/:id - requested id:", id);

    const links = loadShareLinks();
    const link = links.find((l) => l.id === id);

    if (!link) {
      res.status(404).json({ error: "Share link not found" });
      return;
    }

    console.log("GET /api/v2/:id - found, data length:", link.data.length);

    // Decode base64 back to binary
    const dataBuffer = Buffer.from(link.data, "base64");
    res.set("Content-Type", "application/octet-stream");
    res.send(dataBuffer);
  } catch (error) {
    console.error("Error fetching share link:", error);
    res.status(500).json({ error: "Failed to fetch share link" });
  }
});

// ============ Scenes API ============

// POST /api/scenes/:roomId - Save scene
app.post("/api/scenes/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const dataBuffer = await readRawBody(req);
    const updatedAt = Date.now();

    // Store as base64 to preserve binary data in JSON
    const scenes = loadScenes();
    const existingIndex = scenes.findIndex((s) => s.roomId === roomId);

    if (existingIndex >= 0) {
      scenes[existingIndex] = {
        roomId,
        data: dataBuffer.toString("base64"),
        updatedAt,
      };
    } else {
      scenes.push({
        roomId,
        data: dataBuffer.toString("base64"),
        updatedAt,
      });
    }
    saveScenes(scenes);

    res.json({ success: true, roomId, updatedAt });
  } catch (error) {
    console.error("Error saving scene:", error);
    res.status(500).json({ error: "Failed to save scene" });
  }
});

// GET /api/scenes/:roomId - Load scene
app.get("/api/scenes/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const scenes = loadScenes();
    const scene = scenes.find((s) => s.roomId === roomId);

    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }

    // Decode base64 back to binary
    const dataBuffer = Buffer.from(scene.data, "base64");

    // Try to parse as JSON, otherwise return raw buffer
    try {
      const json = JSON.parse(dataBuffer.toString());
      res.json(json);
    } catch {
      res.set("Content-Type", "application/octet-stream");
      res.send(dataBuffer);
    }
  } catch (error) {
    console.error("Error loading scene:", error);
    res.status(500).json({ error: "Failed to load scene" });
  }
});

// ============ Files API ============

// POST /api/files/:roomId/:fileId - Upload file
app.post("/api/files/:roomId/:fileId", async (req, res) => {
  try {
    const { roomId, fileId } = req.params;
    const dataBuffer = await readRawBody(req);

    // Create room directory if it doesn't exist
    const roomDir = path.join(FILE_STORAGE_PATH, roomId);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(roomDir, fileId);
    fs.writeFileSync(filePath, dataBuffer);

    res.json({ success: true, roomId, fileId });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// GET /api/files/:roomId/:fileId - Download file
app.get("/api/files/:roomId/:fileId", async (req, res) => {
  try {
    const { roomId, fileId } = req.params;
    const filePath = path.join(FILE_STORAGE_PATH, roomId, fileId);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const data = fs.readFileSync(filePath);
    res.set("Content-Type", "application/octet-stream");
    res.send(data);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Excalidraw backend listening on port ${port}`);
  console.log(`Data storage: ${DATA_PATH}`);
  console.log(`File storage: ${FILE_STORAGE_PATH}`);
});

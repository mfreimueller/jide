package at.jide.helper;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import javax.tools.JavaCompiler;

/** Line protocol: one JSON request in, one JSON response out. */
public final class Protocol {

    private static final Gson GSON = new GsonBuilder().serializeNulls().disableHtmlEscaping().create();

    private final HelperCompiler compiler;
    private final boolean hasCompiler;
    private boolean shutdown;

    public Protocol(JavaCompiler javaCompiler) {
        this.compiler = new HelperCompiler(javaCompiler);
        this.hasCompiler = javaCompiler != null;
    }

    public boolean shutdownRequested() { return shutdown; }

    static String version() {
        try (InputStream in = Protocol.class.getResourceAsStream("/version.properties")) {
            if (in == null) return "dev";
            Properties p = new Properties();
            p.load(in);
            String v = p.getProperty("version", "dev");
            return v.startsWith("${") ? "dev" : v;
        } catch (IOException e) {
            return "dev";
        }
    }

    /** Handles one request line and returns the response as a single-line JSON string. */
    public String handle(String line) {
        JsonObject req;
        JsonElement id = com.google.gson.JsonNull.INSTANCE;
        try {
            JsonElement parsed = JsonParser.parseString(line);
            if (!parsed.isJsonObject()) return error(id, "Ungültige Anfrage: JSON-Objekt erwartet.");
            req = parsed.getAsJsonObject();
        } catch (RuntimeException e) {
            return error(id, "Ungültige Anfrage: kein gültiges JSON.");
        }
        if (req.has("id")) id = req.get("id");

        try {
            JsonElement opEl = req.get("op");
            String op = opEl != null && opEl.isJsonPrimitive() ? opEl.getAsString() : null;
            if (op == null) return error(id, "Ungültige Anfrage: 'op' fehlt.");
            switch (op) {
                case "shutdown" -> {
                    shutdown = true;
                    JsonObject r = ok(id);
                    return GSON.toJson(r);
                }
                case "ping" -> {
                    if (!hasCompiler) return error(id, HelperCompiler.NO_COMPILER);
                    JsonObject r = ok(id);
                    r.addProperty("version", version());
                    r.addProperty("javaVersion", System.getProperty("java.version"));
                    return GSON.toJson(r);
                }
                case "compile" -> {
                    return GSON.toJson(compile(id, req));
                }
                default -> {
                    return error(id, "Unbekannte Operation: '" + op + "'.");
                }
            }
        } catch (BadRequest e) {
            return error(id, "Ungültige Anfrage: " + e.getMessage());
        } catch (IllegalStateException | IllegalArgumentException e) {
            return error(id, e.getMessage());
        } catch (Exception e) {
            return error(id, "Interner Fehler im Java-Helfer: " + e);
        }
    }

    private JsonObject compile(JsonElement id, JsonObject req) throws IOException {
        List<SourceFile> files = new ArrayList<>();
        JsonElement filesEl = req.get("files");
        if (filesEl == null || !filesEl.isJsonArray()) throw new BadRequest("'files' fehlt.");
        for (JsonElement fe : filesEl.getAsJsonArray()) {
            JsonObject fo = obj(fe, "files[]");
            files.add(new SourceFile(str(fo, "path"), str(fo, "content")));
        }
        Harness harness = null;
        JsonElement he = req.get("harness");
        if (he != null && !he.isJsonNull()) {
            JsonObject ho = obj(he, "harness");
            harness = new Harness(str(ho, "appendTo"), str(ho, "content"));
        }
        Path outDir = null;
        JsonElement oe = req.get("outDir");
        if (oe != null && !oe.isJsonNull()) {
            if (!oe.isJsonPrimitive()) throw new BadRequest("'outDir' muss ein Text sein.");
            outDir = Path.of(oe.getAsString());
        }

        CompileResult res = compiler.compile(files, harness, outDir);
        JsonObject r = ok(id);
        r.addProperty("success", res.success());
        JsonArray arr = new JsonArray();
        for (Diag d : res.diagnostics()) arr.add(GSON.toJsonTree(d));
        r.add("diagnostics", arr);
        return r;
    }

    private static JsonObject obj(JsonElement e, String what) {
        if (!e.isJsonObject()) throw new BadRequest("'" + what + "' muss ein Objekt sein.");
        return e.getAsJsonObject();
    }

    private static String str(JsonObject o, String key) {
        JsonElement e = o.get(key);
        if (e == null || !e.isJsonPrimitive()) throw new BadRequest("'" + key + "' fehlt oder ist kein Text.");
        return e.getAsString();
    }

    private static JsonObject ok(JsonElement id) {
        JsonObject r = new JsonObject();
        r.add("id", id);
        r.addProperty("ok", true);
        return r;
    }

    private static String error(JsonElement id, String message) {
        JsonObject r = new JsonObject();
        r.add("id", id);
        r.addProperty("ok", false);
        r.addProperty("error", message);
        return GSON.toJson(r);
    }

    private static final class BadRequest extends RuntimeException {
        BadRequest(String m) { super(m); }
    }
}

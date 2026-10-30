package at.jide.helper;

import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import javax.tools.ToolProvider;

public final class Main {
    public static void main(String[] args) throws IOException {
        // Keep stdout exclusively for protocol responses; anything else printed goes to stderr.
        PrintStream protocolOut =
                new PrintStream(new FileOutputStream(FileDescriptor.out), false, StandardCharsets.UTF_8);
        System.setOut(System.err);

        Protocol protocol = new Protocol(ToolProvider.getSystemJavaCompiler());
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = in.readLine()) != null) {
            if (line.isBlank()) continue;
            protocolOut.print(protocol.handle(line) + "\n");
            protocolOut.flush();
            if (protocol.shutdownRequested()) break;
        }
        System.exit(0);
    }
}

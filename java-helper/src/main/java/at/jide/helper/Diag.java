package at.jide.helper;

/** One diagnostic as sent to the app. Line/column are 1-based UTF-16 positions; file/line may be null. */
public record Diag(String file, Integer line, Integer column, Integer endLine, Integer endColumn,
                   String severity, String message, String origin) {

    Diag moved(int l, int c, int el, int ec, String msg, String org) {
        return new Diag(file, l, c, el, ec, severity, msg, org);
    }
}

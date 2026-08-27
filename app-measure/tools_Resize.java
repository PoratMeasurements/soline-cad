import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;

public class Resize {
    public static void main(String[] a) throws Exception {
        BufferedImage in = ImageIO.read(new File(a[0]));
        int[] sizes = {48, 72, 96, 144, 192};
        String[] dirs = {"mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"};
        String base = a[1];
        for (int i = 0; i < sizes.length; i++) {
            int s = sizes[i];
            BufferedImage out = new BufferedImage(s, s, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = out.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(in, 0, 0, s, s, null);
            g.dispose();
            File d = new File(base + "/mipmap-" + dirs[i]);
            d.mkdirs();
            ImageIO.write(out, "png", new File(d, "ic_launcher.png"));
            ImageIO.write(out, "png", new File(d, "ic_launcher_round.png"));
        }
        System.out.println("icons generated: " + in.getWidth() + "x" + in.getHeight() + " -> 5 densities");
    }
}

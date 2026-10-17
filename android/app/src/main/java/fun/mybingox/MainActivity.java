package fun.mybingox;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.androidedgetoedgesupport.EdgeToEdgePlugin;
import fun.mybingox.unity.UnityAdsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        // Backward-compatible edge-to-edge on Android versions before 15 (Play Vitals).
        EdgeToEdge.enable(this);
        registerPlugin(EdgeToEdgePlugin.class);
        registerPlugin(UnityAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package fun.mybingox;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.androidedgetoedgesupport.EdgeToEdgePlugin;
import fun.mybingox.unity.UnityAdsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EdgeToEdgePlugin.class);
        registerPlugin(UnityAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

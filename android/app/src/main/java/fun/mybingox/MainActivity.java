package fun.mybingox;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitor.plugins.edgetoedge.EdgeToEdgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EdgeToEdgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

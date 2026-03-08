import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import { CameraView as ExpoCameraView, CameraType } from "expo-camera";

interface CameraViewComponentProps {
  active: boolean;
}

// Forward ref so the parent screen can call takePictureAsync
const CameraViewComponent = forwardRef<ExpoCameraView, CameraViewComponentProps>(
  ({ active }, ref) => {
    return (
      <ExpoCameraView
        ref={ref}
        style={StyleSheet.absoluteFill}
        facing={"back" as CameraType}
        // Keep camera active but dim overlay when idle
        // The live preview is always visible for accessibility
      />
    );
  }
);

CameraViewComponent.displayName = "CameraViewComponent";

export default CameraViewComponent;

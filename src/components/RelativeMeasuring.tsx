import { useState, useRef, useEffect, useCallback } from "react";

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  startPoint: Point;
  endPoint: Point;
  value?: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface RelativeMeasuringProps {
  onMeasurementComplete: (measurement: number) => void;
}

export function RelativeMeasuring({
  onMeasurementComplete,
}: RelativeMeasuringProps) {
  const [image, setImage] = useState<string | null>(null);
  const [referenceMeasurement, setReferenceMeasurement] =
    useState<Measurement | null>(null);
  const [nailMeasurement, setNailMeasurement] = useState<Measurement | null>(
    null
  );
  const [referenceSize, setReferenceSize] = useState<number>(0);
  const [isSettingReference, setIsSettingReference] = useState(true);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [mousePosition, setMousePosition] = useState<Point | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImage(result);

        // Create image element for getting dimensions
        const img = new Image();
        img.src = result;
        img.onload = () => {
          imageRef.current = img;
          if (canvasRef.current && containerRef.current) {
            const canvas = canvasRef.current;
            const container = containerRef.current;

            // Set canvas size to be square based on container width
            const size = container.clientWidth;
            canvas.width = size;
            canvas.height = size;

            setViewTransform({ scale: 1, offsetX: 0, offsetY: 0 });
            requestAnimationFrame(drawImage);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Draw the image and measurements on canvas
  const drawImage = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;

    // Clear canvas and reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions to fit image within canvas while maintaining aspect ratio
    const imageAspectRatio = img.height / img.width;
    const canvasAspectRatio = canvas.height / canvas.width;

    let drawWidth, drawHeight;

    if (imageAspectRatio < canvasAspectRatio) {
      // Image is wider relative to canvas
      drawWidth = canvas.width;
      drawHeight = canvas.width * imageAspectRatio;
    } else {
      // Image is taller relative to canvas
      drawHeight = canvas.height;
      drawWidth = canvas.height / imageAspectRatio;
    }

    // Calculate offset to center the image
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    // Apply transformations for zoom and pan
    ctx.setTransform(
      viewTransform.scale,
      0,
      0,
      viewTransform.scale,
      viewTransform.offsetX + offsetX * viewTransform.scale,
      viewTransform.offsetY + offsetY * viewTransform.scale
    );

    // Draw the image with original aspect ratio
    ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

    // Helper function to draw measurement line with label
    const drawMeasurementLine = (
      measurement: Measurement,
      color: string,
      label?: string
    ) => {
      // Draw main line
      ctx.beginPath();
      ctx.moveTo(measurement.startPoint.x, measurement.startPoint.y);
      ctx.lineTo(measurement.endPoint.x, measurement.endPoint.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / viewTransform.scale; // Adjust line width for zoom
      ctx.stroke();

      // Draw perpendicular end lines for precise measurement
      const angle = Math.atan2(
        measurement.endPoint.y - measurement.startPoint.y,
        measurement.endPoint.x - measurement.startPoint.x
      );
      const perpendicularAngle = angle + Math.PI / 2;
      const lineLength = 6 / viewTransform.scale; // Adjust length for zoom

      // Draw start perpendicular line
      ctx.beginPath();
      ctx.moveTo(
        measurement.startPoint.x +
          Math.cos(perpendicularAngle) * (lineLength / 2),
        measurement.startPoint.y +
          Math.sin(perpendicularAngle) * (lineLength / 2)
      );
      ctx.lineTo(
        measurement.startPoint.x -
          Math.cos(perpendicularAngle) * (lineLength / 2),
        measurement.startPoint.y -
          Math.sin(perpendicularAngle) * (lineLength / 2)
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / viewTransform.scale;
      ctx.stroke();

      // Draw end perpendicular line
      ctx.beginPath();
      ctx.moveTo(
        measurement.endPoint.x +
          Math.cos(perpendicularAngle) * (lineLength / 2),
        measurement.endPoint.y + Math.sin(perpendicularAngle) * (lineLength / 2)
      );
      ctx.lineTo(
        measurement.endPoint.x -
          Math.cos(perpendicularAngle) * (lineLength / 2),
        measurement.endPoint.y - Math.sin(perpendicularAngle) * (lineLength / 2)
      );
      ctx.stroke();

      // Draw measurement value if provided
      if (label) {
        const midX = (measurement.startPoint.x + measurement.endPoint.x) / 2;
        const midY = (measurement.startPoint.y + measurement.endPoint.y) / 2;

        // Save current transform for text
        const currentTransform = ctx.getTransform();
        ctx.resetTransform();

        // Convert mid point to screen coordinates
        const screenX = midX * viewTransform.scale + viewTransform.offsetX;
        const screenY = midY * viewTransform.scale + viewTransform.offsetY;

        // Draw background for better readability
        ctx.font = "14px Arial";
        const textMetrics = ctx.measureText(label);
        const padding = 4;

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillRect(
          screenX - textMetrics.width / 2 - padding,
          screenY - 10 - padding,
          textMetrics.width + padding * 2,
          20 + padding * 2
        );

        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, screenX, screenY);

        // Restore transform
        ctx.setTransform(currentTransform);
      }
    };

    // Draw measurements
    if (referenceMeasurement) {
      drawMeasurementLine(
        referenceMeasurement,
        "#00ff00",
        `${referenceSize}mm`
      );
    }

    if (nailMeasurement) {
      drawMeasurementLine(
        nailMeasurement,
        "#ff0000",
        nailMeasurement.value
          ? `${nailMeasurement.value.toFixed(1)}mm`
          : undefined
      );
    }

    if (startPoint && mousePosition) {
      drawMeasurementLine(
        { startPoint, endPoint: mousePosition },
        isSettingReference ? "#00ff00" : "#ff0000"
      );
    }

    // Draw zoom indicator with clean white text
    ctx.resetTransform();
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "right";
    const zoomText = `${Math.round(viewTransform.scale * 100)}%`;

    // Add shadow for better visibility
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(zoomText, canvas.width - 11, 25);
    ctx.fillText(zoomText, canvas.width - 9, 25);
    ctx.fillText(zoomText, canvas.width - 10, 26);
    ctx.fillText(zoomText, canvas.width - 10, 24);

    // Draw white text
    ctx.fillStyle = "white";
    ctx.fillText(zoomText, canvas.width - 10, 25);
  }, [
    viewTransform,
    referenceMeasurement,
    nailMeasurement,
    startPoint,
    mousePosition,
    referenceSize,
    isSettingReference,
  ]);

  // Handle transform updates with RAF
  const requestRedraw = useCallback(() => {
    requestAnimationFrame(drawImage);
  }, [drawImage]);

  // Simple zoom handler - only handles scaling
  const handleZoom = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      // Get mouse position relative to canvas
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calculate new scale with more dramatic zoom
      const zoomDirection = event.deltaY < 0 ? 1 : -1;
      const zoomIntensity = 0.25; // 25% zoom per scroll
      const newScale = Math.min(
        Math.max(viewTransform.scale + zoomDirection * zoomIntensity, 0.5),
        10 // Increased max zoom to 1000%
      );

      // Calculate the point in the image space that's under the mouse
      const pointX = (mouseX - viewTransform.offsetX) / viewTransform.scale;
      const pointY = (mouseY - viewTransform.offsetY) / viewTransform.scale;

      // Calculate new offsets to keep the point under the mouse
      const newOffsetX = mouseX - pointX * newScale;
      const newOffsetY = mouseY - pointY * newScale;

      setViewTransform({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
      requestRedraw();
    },
    [viewTransform, requestRedraw]
  );

  // Simple pan handler - only handles moving the image
  const handlePan = useCallback(
    (dx: number, dy: number) => {
      setViewTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      requestRedraw();
    },
    [viewTransform, requestRedraw]
  );

  // Mouse handlers for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 1 || event.button === 2) {
      // Middle or right mouse button
      event.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning || !lastPanPoint) return;

    const dx = event.clientX - lastPanPoint.x;
    const dy = event.clientY - lastPanPoint.y;

    handlePan(dx, dy);
    setLastPanPoint({ x: event.clientX, y: event.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setLastPanPoint(null);
  };

  // Add wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleZoom, { passive: false });
    return () => canvas.removeEventListener("wheel", handleZoom);
  }, [handleZoom]);

  // Get scaled coordinates considering zoom and pan
  const getScaledCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to canvas coordinates
    const canvasX = (mouseX * canvas.width) / rect.width;
    const canvasY = (mouseY * canvas.height) / rect.height;

    // Apply inverse transform to get coordinates in image space
    const x = (canvasX - viewTransform.offsetX) / viewTransform.scale;
    const y = (canvasY - viewTransform.offsetY) / viewTransform.scale;

    return { x, y };
  };

  // Handle canvas click for measurements
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return;

    console.log("DRAW", {
      isSettingReference,
      hasStartPoint: !!startPoint,
      mouseX: event.clientX,
      mouseY: event.clientY,
    });

    const point = getScaledCoordinates(event);
    if (!point) return;

    if (isSettingReference) {
      if (!startPoint) {
        setStartPoint(point);
      } else {
        const measurement = {
          startPoint: startPoint,
          endPoint: point,
        };
        setReferenceMeasurement(measurement);
        setStartPoint(null);
        setIsSettingReference(false);
      }
    } else {
      if (!startPoint) {
        setStartPoint(point);
      } else {
        const measurement = {
          startPoint: startPoint,
          endPoint: point,
        };
        const calculatedValue = calculateMeasurement(measurement);
        setNailMeasurement({ ...measurement, value: calculatedValue });
        setStartPoint(null);
        if (calculatedValue) {
          onMeasurementComplete(calculatedValue);
        }
      }
    }
  };

  // Calculate the actual measurement
  const calculateMeasurement = (measurement: Measurement) => {
    if (!referenceMeasurement || !referenceSize) return;

    const referencePixelLength = Math.sqrt(
      Math.pow(
        referenceMeasurement.endPoint.x - referenceMeasurement.startPoint.x,
        2
      ) +
        Math.pow(
          referenceMeasurement.endPoint.y - referenceMeasurement.startPoint.y,
          2
        )
    );

    const nailPixelLength = Math.sqrt(
      Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) +
        Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)
    );

    const pixelsPerMM = referencePixelLength / referenceSize;
    return nailPixelLength / pixelsPerMM;
  };

  // Track mouse movement for live line drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!startPoint) return;

      const point = getScaledCoordinates(
        event as unknown as React.MouseEvent<HTMLCanvasElement>
      );
      if (point) {
        setMousePosition(point);
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    return () => canvas.removeEventListener("mousemove", handleMouseMove);
  }, [startPoint, viewTransform]);

  // Update canvas when measurements change
  useEffect(() => {
    drawImage();
  }, [drawImage]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Upload Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-gray-50 file:text-gray-700
              hover:file:bg-gray-100"
          />
        </div>

        {image && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Size (mm)
              </label>
              <input
                type="number"
                value={referenceSize}
                onChange={(e) =>
                  setReferenceSize(parseFloat(e.target.value) || 0)
                }
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm"
                placeholder="Enter size in mm"
              />
            </div>

            <div
              ref={containerRef}
              className="relative border rounded-lg overflow-hidden aspect-square"
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full cursor-crosshair"
              />
              <div className="absolute top-4 left-4 bg-white/80 rounded px-3 py-2">
                <p className="text-sm font-medium text-gray-700">
                  {isSettingReference
                    ? "Click to mark reference object start and end points"
                    : "Click to mark nail width start and end points"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Use mouse wheel to zoom, right-click + drag to pan
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setReferenceMeasurement(null);
                  setNailMeasurement(null);
                  setStartPoint(null);
                  setIsSettingReference(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Reset Measurements
              </button>
              <button
                onClick={() => {
                  setImage(null);
                  setReferenceMeasurement(null);
                  setNailMeasurement(null);
                  setStartPoint(null);
                  setIsSettingReference(true);
                  setReferenceSize(0);
                  setViewTransform({ scale: 1, offsetX: 0, offsetY: 0 });
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Clear Image
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

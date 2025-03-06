import { useState, useEffect } from "react";
import { fetchData, insertData } from "../lib/database";
import { ensureAuthenticated } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import {
  NailTipSet as BaseNailTipSet,
  NailTipSize,
  Brand,
} from "../types/database";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { SelectClientModal } from "./SelectClientModal";
import leftHandImage from "../assets/images/left-hand.png";
import rightHandImage from "../assets/images/right-hand.png";

interface NailTipSet extends BaseNailTipSet {
  brand: string;
}

interface Client {
  id: number;
  name: string;
  notes: string | null;
  created_at?: string;
  nail_tech_id: string;
}

interface FingerMeasurement {
  finger_position: string;
  nail_bed_width: number;
  nail_bed_curve?: number;
  id?: number;
  client_id?: number;
  nail_tip_set_id?: number;
  date_measured?: string;
  client_name?: string;
  notes?: string;
}

interface NailFittingProps {
  clientId?: number;
}

interface MatchedSizes {
  width?: NailTipSize;
  curve?: NailTipSize;
}

interface NailSetDisplay extends NailTipSet {
  displayName: string;
}

interface ClientInfo {
  name: string;
  notes: string;
}

const DEFAULT_MEASUREMENTS: FingerMeasurement[] = [
  { finger_position: "Left Thumb", nail_bed_width: 0 },
  { finger_position: "Left Index", nail_bed_width: 0 },
  { finger_position: "Left Middle", nail_bed_width: 0 },
  { finger_position: "Left Ring", nail_bed_width: 0 },
  { finger_position: "Left Pinky", nail_bed_width: 0 },
  { finger_position: "Right Thumb", nail_bed_width: 0 },
  { finger_position: "Right Index", nail_bed_width: 0 },
  { finger_position: "Right Middle", nail_bed_width: 0 },
  { finger_position: "Right Ring", nail_bed_width: 0 },
  { finger_position: "Right Pinky", nail_bed_width: 0 },
];

export function NailFitting({ clientId }: NailFittingProps) {
  const [measurements, setMeasurements] =
    useState<FingerMeasurement[]>(DEFAULT_MEASUREMENTS);
  const [nailSets, setNailSets] = useState<NailSetDisplay[]>([]);
  const [selectedSet, setSelectedSet] = useState<NailSetDisplay | null>(null);
  const [query, setQuery] = useState("");
  const [matchedSizes, setMatchedSizes] = useState<
    Record<string, MatchedSizes>
  >({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    notes: "",
  });
  const [shakeError, setShakeError] = useState(false);
  const [isSelectClientModalOpen, setIsSelectClientModalOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Ensure we're authenticated before making any database calls
        await ensureAuthenticated();
        await loadNailSets();
        if (clientId) {
          await loadSavedMeasurements();
        }
      } catch (error) {
        console.error("Initialization error:", error);
      }
    }
    init();
  }, [clientId]);

  async function loadNailSets() {
    try {
      // Fetch nail tip sets
      const sets = await fetchData<NailTipSet>("Nail Tip Sets");
      // Fetch all brands
      const brands = await fetchData<Brand>("Brand");

      const setsWithDisplay = sets.map((set) => {
        const brand = brands.find((b) => b.id === set.brand_id);
        return {
          ...set,
          brand: brand?.name || "Unknown",
          displayName: `${brand?.name || "Unknown"} ${set.name} ${set.shape} ${
            set.length || ""
          }`.trim(),
        };
      });
      setNailSets(setsWithDisplay);
    } catch (error) {
      console.error("Error loading nail sets:", error);
    }
  }

  async function loadSavedMeasurements() {
    try {
      setLoading(true);
      // Fetch the most recent measurements for this client
      const savedMeasurements = await fetchData<FingerMeasurement>(
        "Measurements",
        undefined,
        {
          eq: { column: "client_id", value: clientId },
          order: { column: "date_measured", ascending: false },
        }
      );

      if (savedMeasurements.length > 0) {
        // Group by date_measured to get the most recent complete set
        const measurementsByDate = savedMeasurements.reduce(
          (acc, measurement) => {
            const date = measurement.date_measured;
            if (!acc[date!]) {
              acc[date!] = [];
            }
            acc[date!].push(measurement);
            return acc;
          },
          {} as Record<string, FingerMeasurement[]>
        );

        // Get the most recent complete set (should have 10 measurements)
        const mostRecentDate = Object.keys(measurementsByDate)[0];
        const mostRecentSet = measurementsByDate[mostRecentDate];

        if (mostRecentSet.length === 10) {
          // Sort measurements to match our default order
          const sortedMeasurements = DEFAULT_MEASUREMENTS.map(
            (defaultMeasurement) => {
              const savedMeasurement = mostRecentSet.find(
                (m) => m.finger_position === defaultMeasurement.finger_position
              );
              return savedMeasurement || defaultMeasurement;
            }
          );

          setMeasurements(sortedMeasurements);

          // If there's a nail tip set associated, select it
          if (mostRecentSet[0].nail_tip_set_id) {
            const associatedSet = nailSets.find(
              (set) => set.id === mostRecentSet[0].nail_tip_set_id
            );
            if (associatedSet) {
              setSelectedSet(associatedSet);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved measurements:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMeasurementChange(
    index: number,
    field: keyof Omit<FingerMeasurement, "finger_position">,
    value: string
  ) {
    const newMeasurements = [...measurements];
    newMeasurements[index] = {
      ...newMeasurements[index],
      [field]: parseFloat(value) || 0,
    };
    setMeasurements(newMeasurements);
  }

  async function handleSaveClick() {
    if (!clientInfo.name.trim()) {
      setShakeError(true);
      // Reset shake after animation completes
      setTimeout(() => setShakeError(false), 820); // 800ms animation + 20ms buffer
      return;
    }

    try {
      setSaveStatus("saving");

      // Ensure we're authenticated before saving
      await ensureAuthenticated();

      // Debug: Log user information
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("User error:", userError);
        throw new Error("Error getting user");
      }

      if (!user) {
        console.error("No user found");
        throw new Error("No authenticated user found");
      }

      console.log("Current user details:", {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      });

      // Check user credits
      const { data: userCredits, error: creditsError } = await supabase
        .from("User Credits")
        .select("credits, is_admin")
        .eq("user_id", user.id)
        .single();

      // Enhanced credit info logging
      console.log("💳 User Credits Status:", {
        available: userCredits?.credits ?? 0,
        isAdmin: userCredits?.is_admin ?? false,
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: creditsError
          ? {
              message: creditsError.message,
              code: creditsError.code,
            }
          : null,
      });

      if (creditsError) {
        console.error("Error fetching user credits:", creditsError);
      }

      if (!userCredits || (!userCredits.is_admin && userCredits.credits <= 0)) {
        throw new Error("Insufficient credits");
      }

      // First, save client information to Clients table
      const [clientRecord] = (await insertData("Clients", {
        name: clientInfo.name,
        notes: clientInfo.notes || null,
        nail_tech_id: user.id,
      })) as Client[];

      if (!clientRecord || !clientRecord.id) {
        throw new Error("Failed to create client record");
      }

      // Then save measurements with the client ID
      const timestamp = new Date().toISOString();
      await Promise.all(
        measurements.map((measurement) =>
          insertData("Measurements", {
            finger_position: measurement.finger_position,
            nail_bed_width: measurement.nail_bed_width,
            nail_bed_curve: measurement.nail_bed_curve,
            nail_tip_set_id: selectedSet?.id,
            date_measured: timestamp,
            client_id: clientRecord.id,
          })
        )
      );

      // Deduct credit if not admin
      if (!userCredits.is_admin) {
        await supabase
          .from("User Credits")
          .update({ credits: userCredits.credits - 1 })
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
      }

      setSaveStatus("saved");
      // Reset client info
      setClientInfo({
        name: "",
        notes: "",
      });
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error saving:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Filter nail sets based on search query
  const filteredNailSets =
    query === ""
      ? nailSets
      : nailSets.filter((set) =>
          set.displayName.toLowerCase().includes(query.toLowerCase())
        );

  async function findMatchingSizes() {
    if (!selectedSet) return;

    try {
      setLoading(true);
      // Fetch sizes for selected set
      const sizes = await fetchData<NailTipSize>(
        "Nail Tip Sizes",
        `tip_set_id = ${selectedSet.id}`
      );

      // Match sizes for each finger
      const matches: Record<string, MatchedSizes> = {};

      measurements.forEach((measurement) => {
        const matchResult: MatchedSizes = {};

        // Find width match
        if (measurement.nail_bed_width > 0) {
          const validWidthSizes = sizes.filter(
            (size) => size.width <= measurement.nail_bed_width
          );
          if (validWidthSizes.length > 0) {
            matchResult.width = validWidthSizes.sort(
              (a, b) => b.width - a.width
            )[0];
          }
        }

        // Find curve match
        const measurementCurve = measurement.nail_bed_curve;
        if (measurementCurve !== undefined && measurementCurve > 0) {
          const validCurveSizes = sizes.filter(
            (size) =>
              size.inner_curve !== undefined &&
              size.inner_curve >= measurementCurve
          );
          matchResult.curve = validCurveSizes.sort(
            (a, b) => (a.inner_curve || 0) - (b.inner_curve || 0)
          )[0];
        }

        matches[measurement.finger_position] = matchResult;
      });

      setMatchedSizes(matches);
    } catch (error) {
      console.error("Error finding matching sizes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClientSelect(selectedClientId: number) {
    try {
      setLoading(true);
      // Fetch client info
      const [client] = await fetchData<Client>(
        "Clients",
        `id = ${selectedClientId}`
      );
      if (client) {
        setClientInfo({
          name: client.name,
          notes: client.notes || "",
        });
      }

      // Fetch the most recent measurements for this client
      const savedMeasurements = await fetchData<FingerMeasurement>(
        "Measurements",
        undefined,
        {
          eq: { column: "client_id", value: selectedClientId },
          order: { column: "date_measured", ascending: false },
        }
      );

      if (savedMeasurements.length > 0) {
        // Group by date_measured to get the most recent complete set
        const measurementsByDate = savedMeasurements.reduce(
          (acc, measurement) => {
            const date = measurement.date_measured;
            if (!acc[date!]) {
              acc[date!] = [];
            }
            acc[date!].push(measurement);
            return acc;
          },
          {} as Record<string, FingerMeasurement[]>
        );

        // Get the most recent complete set (should have 10 measurements)
        const mostRecentDate = Object.keys(measurementsByDate)[0];
        const mostRecentSet = measurementsByDate[mostRecentDate];

        if (mostRecentSet.length === 10) {
          // Sort measurements to match our default order
          const sortedMeasurements = DEFAULT_MEASUREMENTS.map(
            (defaultMeasurement) => {
              const savedMeasurement = mostRecentSet.find(
                (m) => m.finger_position === defaultMeasurement.finger_position
              );
              return savedMeasurement || defaultMeasurement;
            }
          );

          setMeasurements(sortedMeasurements);

          // If there's a nail tip set associated, select it
          if (mostRecentSet[0].nail_tip_set_id) {
            const associatedSet = nailSets.find(
              (set) => set.id === mostRecentSet[0].nail_tip_set_id
            );
            if (associatedSet) {
              setSelectedSet(associatedSet);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading client data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full h-full min-h-full flex flex-col">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
      <div className="w-full flex-1 space-y-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-medium text-gray-900">
                Find Matching Sizes
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Combobox value={selectedSet} onChange={setSelectedSet}>
                  <div className="relative">
                    <div className="relative w-full">
                      <Combobox.Input
                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 sm:text-sm"
                        onChange={(event) => setQuery(event.target.value)}
                        displayValue={(set: NailSetDisplay | null) =>
                          set?.displayName || ""
                        }
                        placeholder="Select or search a nail tip set..."
                      />
                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </Combobox.Button>
                    </div>
                    <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      {filteredNailSets.length === 0 && query !== "" ? (
                        <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                          Nothing found.
                        </div>
                      ) : (
                        filteredNailSets.map((set) => (
                          <Combobox.Option
                            key={set.id}
                            className={({ active }) =>
                              `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                active
                                  ? "bg-gray-50 text-gray-900"
                                  : "text-gray-900"
                              }`
                            }
                            value={set}
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${
                                    selected ? "font-medium" : "font-normal"
                                  }`}
                                >
                                  {set.displayName}
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="w-5 h-5"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Combobox.Option>
                        ))
                      )}
                    </Combobox.Options>
                  </div>
                </Combobox>
              </div>
              <button
                type="button"
                onClick={findMatchingSizes}
                disabled={!selectedSet || loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 whitespace-nowrap"
              >
                {loading ? "Finding matches..." : "Match Sizes"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0 p-6">
          {/* Left Hand */}
          <div className="w-full lg:w-1/2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Left
            </h3>
            {/* Single hand image for left hand */}
            <div className="w-full max-w-[400px] mx-auto aspect-w-4 aspect-h-3">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={leftHandImage}
                  alt="Left Hand"
                  className="object-contain w-full h-full max-h-[300px]"
                  onError={(e) => {
                    console.log("Image load error details:", {
                      src: e.currentTarget.src,
                      path: window.location.pathname,
                      absolutePath: new URL(
                        e.currentTarget.src,
                        window.location.href
                      ).href,
                      importPath: leftHandImage,
                    });
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      target.style.display = "none";
                      const placeholder = document.createElement("span");
                      placeholder.textContent = "Left Hand Image";
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {/* Width inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements
                  .slice(0, 5)
                  .reverse()
                  .map((measurement, index) => (
                    <div
                      key={`width-${index}`}
                      className="w-[20%] flex flex-col items-center"
                    >
                      <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-1">
                        {measurement.finger_position.replace("Left ", "")}
                      </label>
                      <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                        Width
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={measurement.nail_bed_width || ""}
                        onChange={(e) =>
                          handleMeasurementChange(
                            4 - index,
                            "nail_bed_width",
                            e.target.value
                          )
                        }
                        className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {/* Width Match Result */}
                      {Object.keys(matchedSizes).length > 0 && (
                        <div className="mt-1">
                          {matchedSizes[measurement.finger_position]?.width ? (
                            <div className="text-base text-gray-700 text-center">
                              <div className="font-bold text-lg">
                                Size{" "}
                                {
                                  matchedSizes[measurement.finger_position]
                                    ?.width?.size_label
                                }
                              </div>
                              <div className="font-medium">
                                {
                                  matchedSizes[measurement.finger_position]
                                    ?.width?.width
                                }
                                mm
                              </div>
                            </div>
                          ) : (
                            <div className="text-base text-red-500 text-center font-medium">
                              No match
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              {/* Curvature inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements
                  .slice(0, 5)
                  .reverse()
                  .map((measurement, index) => (
                    <div
                      key={`curve-${index}`}
                      className="w-[20%] flex flex-col items-center"
                    >
                      <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                        Curvature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={measurement.nail_bed_curve || ""}
                        onChange={(e) =>
                          handleMeasurementChange(
                            4 - index,
                            "nail_bed_curve",
                            e.target.value
                          )
                        }
                        className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {/* Curve Match Result */}
                      {Object.keys(matchedSizes).length > 0 && (
                        <div className="mt-1">
                          {matchedSizes[measurement.finger_position]?.curve ? (
                            <div className="text-base text-gray-700 text-center">
                              <div className="font-bold text-lg">
                                Size{" "}
                                {
                                  matchedSizes[measurement.finger_position]
                                    ?.curve?.size_label
                                }
                              </div>
                              <div className="font-medium">
                                {
                                  matchedSizes[measurement.finger_position]
                                    ?.curve?.inner_curve
                                }
                                mm
                              </div>
                            </div>
                          ) : (
                            <div className="text-base text-red-500 text-center font-medium">
                              No match
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right Hand */}
          <div className="w-full lg:w-1/2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Right
            </h3>
            {/* Single hand image for right hand */}
            <div className="w-full max-w-[400px] mx-auto aspect-w-4 aspect-h-3">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={rightHandImage}
                  alt="Right Hand"
                  className="object-contain w-full h-full max-h-[300px]"
                  onError={(e) => {
                    console.log("Image load error details:", {
                      src: e.currentTarget.src,
                      path: window.location.pathname,
                      absolutePath: new URL(
                        e.currentTarget.src,
                        window.location.href
                      ).href,
                      importPath: rightHandImage,
                    });
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      target.style.display = "none";
                      const placeholder = document.createElement("span");
                      placeholder.textContent = "Right Hand Image";
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {/* Width inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements.slice(5).map((measurement, index) => (
                  <div
                    key={`width-${index + 5}`}
                    className="w-[20%] flex flex-col items-center"
                  >
                    <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-1">
                      {measurement.finger_position.replace("Right ", "")}
                    </label>
                    <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                      Width
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={measurement.nail_bed_width || ""}
                      onChange={(e) =>
                        handleMeasurementChange(
                          index + 5,
                          "nail_bed_width",
                          e.target.value
                        )
                      }
                      className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {/* Width Match Result */}
                    {Object.keys(matchedSizes).length > 0 && (
                      <div className="mt-1">
                        {matchedSizes[measurement.finger_position]?.width ? (
                          <div className="text-base text-gray-700 text-center">
                            <div className="font-bold text-lg">
                              Size{" "}
                              {
                                matchedSizes[measurement.finger_position]?.width
                                  ?.size_label
                              }
                            </div>
                            <div className="font-medium">
                              {
                                matchedSizes[measurement.finger_position]?.width
                                  ?.width
                              }
                              mm
                            </div>
                          </div>
                        ) : (
                          <div className="text-base text-red-500 text-center font-medium">
                            No match
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Curvature inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements.slice(5).map((measurement, index) => (
                  <div
                    key={`curve-${index + 5}`}
                    className="w-[20%] flex flex-col items-center"
                  >
                    <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                      Curvature
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={measurement.nail_bed_curve || ""}
                      onChange={(e) =>
                        handleMeasurementChange(
                          index + 5,
                          "nail_bed_curve",
                          e.target.value
                        )
                      }
                      className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {/* Curve Match Result */}
                    {Object.keys(matchedSizes).length > 0 && (
                      <div className="mt-1">
                        {matchedSizes[measurement.finger_position]?.curve ? (
                          <div className="text-base text-gray-700 text-center">
                            <div className="font-bold text-lg">
                              Size{" "}
                              {
                                matchedSizes[measurement.finger_position]?.curve
                                  ?.size_label
                              }
                            </div>
                            <div className="font-medium">
                              {
                                matchedSizes[measurement.finger_position]?.curve
                                  ?.inner_curve
                              }
                              mm
                            </div>
                          </div>
                        ) : (
                          <div className="text-base text-red-500 text-center font-medium">
                            No match
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-700 px-6">
          *All measurements are in millimeters
        </p>

        {/* Client Name Input */}
        <div className="px-6">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={clientInfo.name}
            onChange={(e) =>
              setClientInfo({ ...clientInfo, name: e.target.value })
            }
            className={`mt-1 block w-full rounded-md border ${
              shakeError ? "border-red-500 shake" : "border-gray-300"
            } bg-white px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 sm:text-sm`}
            required
          />
          {shakeError && (
            <p className="mt-1 text-sm text-red-500">Client name is required</p>
          )}
        </div>

        {/* Notes Input */}
        <div className="px-6">
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={clientInfo.notes}
            onChange={(e) =>
              setClientInfo({ ...clientInfo, notes: e.target.value })
            }
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 sm:text-sm"
          />
        </div>

        <div className="flex justify-between px-6 w-full items-center gap-4">
          {/* Select Client Button */}
          <button
            type="button"
            onClick={() => setIsSelectClientModalOpen(true)}
            className=" inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Select Client
          </button>
          {/* Save Status and Button */}
          {saveStatus === "saved" && (
            <span className="text-green-600 text-sm">
              Measurements saved successfully!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600 text-sm">
              Error saving measurements
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={
              !clientInfo.name.trim() || loading || saveStatus === "saving"
            }
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {saveStatus === "saving" ? "Saving..." : "Save Measurements"}
          </button>
        </div>
      </div>

      <SelectClientModal
        isOpen={isSelectClientModalOpen}
        onClose={() => setIsSelectClientModalOpen(false)}
        onSelectClient={handleClientSelect}
      />
    </div>
  );
}

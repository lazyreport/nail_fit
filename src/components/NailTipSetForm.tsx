import { useState, useEffect } from "react";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Brand, NailTipSet, NailTipSize } from "../types/database";
import { fetchData, insertData, updateData } from "../lib/database";
import { supabase } from "../lib/supabase";
import { AddBrandModal } from "./AddBrandModal";
import { Toast } from "./Toast";
import { useNavigate } from "react-router-dom";

interface SizeInput {
  id?: string;
  size_label: string;
  length: number;
  width: number;
  inner_curve?: number;
}

interface NailTipSetFormProps {
  initialData?: {
    id: string;
    brand: Brand;
    name: string;
    shape: string;
    length?: string;
    image_url?: string;
    sizes: NailTipSize[];
  };
}

export function NailTipSetForm({ initialData }: NailTipSetFormProps) {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(
    initialData?.brand || null
  );
  const [name, setName] = useState(initialData?.name || "");
  const [shape, setShape] = useState(initialData?.shape || "");
  const [length, setLength] = useState<string>(
    initialData?.length?.toString() || ""
  );
  const [imageUrl, setImageUrl] = useState(initialData?.image_url || "");
  const [sizeCount, setSizeCount] = useState<string>("");
  const [sizes, setSizes] = useState<SizeInput[]>(
    initialData?.sizes.map((size) => ({
      id: String(size.id),
      size_label: size.size_label,
      length: size.length,
      width: size.width,
      inner_curve: size.inner_curve,
    })) || [{ size_label: "", length: 0, width: 0 }]
  );
  const [showToast, setShowToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    try {
      const loadedBrands = await fetchData<Brand>("Brand");
      setBrands(loadedBrands);
    } catch (err) {
      console.error("Error loading brands:", err);
    }
  }

  const filteredBrands =
    query === ""
      ? brands
      : brands.filter((brand) =>
          brand.name.toLowerCase().includes(query.toLowerCase())
        );

  function handleSizeChange(
    index: number,
    field: keyof SizeInput,
    value: string
  ) {
    const newSizes = [...sizes];
    if (field === "size_label") {
      newSizes[index].size_label = value;
    } else if (field === "length") {
      newSizes[index].length = parseFloat(value) || 0;
    } else if (field === "width") {
      newSizes[index].width = parseFloat(value) || 0;
    } else if (field === "inner_curve") {
      newSizes[index].inner_curve = parseFloat(value) || undefined;
    }
    setSizes(newSizes);
  }

  function addSize() {
    setSizes([
      ...sizes,
      { size_label: "", length: 0, width: 0, inner_curve: 0 },
    ]);
  }

  function removeSize(index: number) {
    setSizes(sizes.filter((_, i) => i !== index));
  }

  function generateSizes(count: number) {
    const newSizes = Array.from({ length: count }, () => ({
      size_label: "",
      length: 0,
      width: 0,
      inner_curve: 0,
    }));
    setSizes([...sizes, ...newSizes]);
    setSizeCount("");
  }

  function handleGenerateSizes(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(sizeCount);
    if (!isNaN(count) && count > 0) {
      generateSizes(count);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrand) return;

    try {
      const setData = {
        brand_id: selectedBrand.id,
        name,
        shape,
        length,
        image_url: imageUrl || undefined,
      };

      if (initialData) {
        // Update existing set
        await updateData("Nail Tip Sets", initialData.id, setData);

        // Get the original sizes to compare
        const originalSizes = initialData.sizes;

        // Handle each size
        await Promise.all(
          sizes.map(async (size) => {
            if (size.id) {
              // Update existing size
              await updateData("Nail Tip Sizes", size.id, {
                size_label: size.size_label,
                length: size.length,
                width: size.width,
                inner_curve: size.inner_curve,
              });
            } else {
              // Add new size
              await insertData("Nail Tip Sizes", {
                tip_set_id: initialData.id,
                ...size,
                created_at: new Date().toISOString(),
              });
            }
          })
        );

        // Delete sizes that were removed
        const currentSizeIds = sizes.map((s) => s.id).filter(Boolean);
        const removedSizeIds = originalSizes
          .map((s) => String(s.id)) // Convert number to string
          .filter((id) => !currentSizeIds.includes(id));

        if (removedSizeIds.length > 0) {
          await Promise.all(
            removedSizeIds.map((id) =>
              supabase.from("Nail Tip Sizes").delete().eq("id", id)
            )
          );
        }
      } else {
        // Create new set
        const [newSet] = await insertData<NailTipSet>("Nail Tip Sets", setData);

        // Insert all sizes for new set
        await Promise.all(
          sizes.map((size) =>
            insertData("Nail Tip Sizes", {
              tip_set_id: newSet.id,
              ...size,
              created_at: new Date().toISOString(),
            })
          )
        );
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate("/nail-sets");
      }, 1500);
    } catch (error) {
      console.error("Error saving nail tip set:", error);
    }
  }

  async function handleDelete() {
    if (
      !initialData ||
      !window.confirm(
        "Are you sure you want to delete this nail tip set? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      // First delete all sizes
      await Promise.all(
        initialData.sizes.map((size) =>
          supabase.from("Nail Tip Sizes").delete().eq("id", String(size.id))
        )
      );

      // Then delete the set
      await supabase.from("Nail Tip Sets").delete().eq("id", initialData.id);

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate("/nail-sets");
      }, 1500);
    } catch (error) {
      console.error("Error deleting nail tip set:", error);
    }
  }

  return (
    <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Brand <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative">
              <Combobox value={selectedBrand} onChange={setSelectedBrand}>
                <div className="relative">
                  <div className="flex">
                    <Combobox.Input
                      className="w-full rounded-l-md border border-r-0 border-gray-300 bg-white py-2 pl-3 pr-10 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                      onChange={(event) => setQuery(event.target.value)}
                      displayValue={(brand: Brand) => brand?.name ?? ""}
                      placeholder="Search brands..."
                    />
                    <Combobox.Button className="relative inline-flex items-center rounded-r-md border border-l-0 border-gray-300 px-2 py-2 text-gray-400 hover:bg-gray-50">
                      <ChevronUpDownIcon
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </Combobox.Button>
                  </div>
                  <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredBrands.map((brand) => (
                      <Combobox.Option
                        key={brand.id}
                        value={brand}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-3 pr-9 ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "text-gray-900"
                          }`
                        }
                      >
                        {brand.name}
                      </Combobox.Option>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsAddBrandModalOpen(true)}
                      className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-indigo-600 hover:bg-indigo-50 w-full text-left"
                    >
                      + Add new brand
                    </button>
                  </Combobox.Options>
                </div>
              </Combobox>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Set Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Shape <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shape}
              onChange={(e) => setShape(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Length
            </label>
            <input
              type="text"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Sizes</h3>

            <div className="flex gap-4 items-end mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">
                  Number of sizes to add
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="number"
                    min="1"
                    value={sizeCount}
                    onChange={(e) => setSizeCount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleGenerateSizes(e);
                      }
                    }}
                    className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    placeholder="Enter number of sizes"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateSizes}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Generate Size Inputs
              </button>
            </div>

            {sizes.map((size, index) => (
              <div
                key={index}
                className="bg-white p-4 rounded-md space-y-4 border border-gray-300"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Size Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={size.size_label}
                      onChange={(e) =>
                        handleSizeChange(index, "size_label", e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Length (mm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={size.length || ""}
                      onChange={(e) =>
                        handleSizeChange(index, "length", e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Width (mm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={size.width || ""}
                      onChange={(e) =>
                        handleSizeChange(index, "width", e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Inner Curve (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={size.inner_curve || ""}
                      onChange={(e) =>
                        handleSizeChange(index, "inner_curve", e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                </div>

                {sizes.length > 1 && (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={() => removeSize(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove Size
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={addSize}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 gap-2"
              >
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                Add Size
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          {initialData && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
            >
              Delete Set
            </button>
          )}
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Nail Tip Set
          </button>
        </div>
      </form>

      <Toast
        show={showToast}
        message={
          initialData
            ? showToast && isDeleting
              ? "Set deleted successfully!"
              : "Set updated successfully!"
            : "Set added successfully!"
        }
      />

      <AddBrandModal
        isOpen={isAddBrandModalOpen}
        onClose={() => setIsAddBrandModalOpen(false)}
        onBrandAdded={(brand) => {
          setBrands((prev) => [...prev, brand]);
          setSelectedBrand(brand);
          setIsAddBrandModalOpen(false);
        }}
      />
    </div>
  );
}

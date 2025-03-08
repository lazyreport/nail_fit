import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { NailTipSetForm } from "../../components/NailTipSetForm";
import { Brand, NailTipSet, NailTipSize } from "../../types/database";
import { fetchData } from "../../lib/database";

interface NailTipSetWithDetails {
  id: number | string;
  brand: Brand;
  name: string;
  shape: string;
  length?: string;
  image_url?: string;
  sizes: NailTipSize[];
}

export default function EditNailTipSet() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nailTipSet, setNailTipSet] = useState<NailTipSetWithDetails | null>(
    null
  );

  useEffect(() => {
    if (id) {
      loadNailTipSet();
    }
  }, [id]);

  async function loadNailTipSet() {
    try {
      // Fetch the specific nail tip set
      const sets = await fetchData<NailTipSet>("Nail Tip Sets", `id = '${id}'`);
      if (sets.length === 0) {
        setError("Nail tip set not found");
        return;
      }
      const set = sets[0];

      // Fetch the brand
      const brands = await fetchData<Brand>("Brand");
      const brand = brands.find((b) => b.id === set.brand_id);
      if (!brand) {
        setError("Brand not found");
        return;
      }

      // Fetch the sizes
      const sizes = await fetchData<NailTipSize>(
        "Nail Tip Sizes",
        `tip_set_id = '${id}'`
      );

      setNailTipSet({
        ...set,
        brand,
        sizes: sizes.sort((a, b) => b.width - a.width),
      });
    } catch (error) {
      setError("Failed to load nail tip set");
      console.error("Error loading nail tip set:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500">Loading nail tip set...</div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>;
  }

  if (!nailTipSet) {
    return <div className="text-center py-12">Nail tip set not found</div>;
  }

  const formattedNailTipSet = {
    ...nailTipSet,
    id: nailTipSet.id.toString(),
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl font-semibold text-gray-900">
          Edit Nail Tip Set
        </h1>
      </div>
      <div className="mt-5">
        <NailTipSetForm initialData={formattedNailTipSet} />
      </div>
    </div>
  );
}

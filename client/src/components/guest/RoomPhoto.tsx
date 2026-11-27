import { useEffect, useState } from 'react';
import { RESORT_STAND_IN, isCottageLike, roomPhotoFor } from '../../lib/images';

interface RoomPhotoProps {
  room: { image_url?: string; offering_type?: string; category?: string; name?: string };
  className: string;
  alt?: string;
}

/** A room's photo that never leaves an empty box: a missing or broken photo link shows the stand-in for its kind. */
export default function RoomPhoto({ room, className, alt = '' }: RoomPhotoProps) {
  const wanted = roomPhotoFor(room);
  const standIn = RESORT_STAND_IN[isCottageLike(room) ? 'cottage' : 'room'];
  const [src, setSrc] = useState(wanted);

  useEffect(() => {
    setSrc(wanted);
  }, [wanted]);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (src !== standIn) setSrc(standIn);
      }}
    />
  );
}

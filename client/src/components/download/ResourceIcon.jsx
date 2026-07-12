import { useEffect, useState } from 'react';

export default function ResourceIcon({ resource, className = '', iconClassName = '', imageClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const Icon = resource.icon;
  const showImage = resource.iconUrl && !failed;

  useEffect(() => {
    setFailed(false);
  }, [resource.iconUrl]);

  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={resource.iconUrl}
          alt=""
          className={`h-full w-full object-cover ${imageClassName}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon size={26} className={iconClassName} />
      )}
    </div>
  );
}

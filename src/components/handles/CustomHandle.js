import {memo} from 'react';
import {Handle} from 'reactflow';

const handleStyle = {
  width: 10,
  height: 10,
  background: 'white',
  border: '1px solid #000',
};

function CustomHandle({type, position}) {
  return <Handle type={type} position={position} style={handleStyle} />;
}

export default memo(CustomHandle);

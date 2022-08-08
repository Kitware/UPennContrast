import math
import numpy as np

def pointToPointDistance(coord1, coord2):
    """Get the distance between two points using points coordinates.
    Points coordinates are represented by {x: x_coord, y: y_coord, z: z_coord}.

    Args:
        coord1 (dict): Coordinates of point 1
        coord2 (dict): Coordinates of point 2

    Returns:
        Number: Squared distance between point1 and point2
    """
    return math.sqrt(
      math.pow(coord1["x"] - coord2["x"], 2) + math.pow(coord1["y"] - coord2["y"], 2) + math.pow(coord1["z"] - coord2["z"], 2)
    )
  

def simpleCentroid(listCoordinates):
    """Compute the simple centroid of a polygon using its list of coordinates.
    The centroid corresponds to the barycenter of the polygon.

    Args:
        listCoordinates (dict[]): List of point coordinates.
          Point coordinates are represented by {x: x_coord, y: y_coord, z: z_coord}

    Returns:
        dict: Coordinates of the centroid
    """
    nbCoordinates = len(listCoordinates)
    x = np.sum([coord["x"] for coord in listCoordinates]) / nbCoordinates
    y = np.sum([coord["y"] for coord in listCoordinates]) / nbCoordinates
    z = np.sum([coord["z"] for coord in listCoordinates]) / nbCoordinates

    return {
      "x": x,
      "y": y,
      "z": z
    }

def isAPoint(annotation):
  return annotation["shape"] == 'point'

def isAPoly(annotation):
  return (annotation["shape"] == 'polygon' or annotation["shape"] == 'line')

def annotationToAnnotationDistance(annotation1, annotation2):
    """Compute the distance between two annotations

    Args:
        annotation1 (_type_): _description_
        annotation2 (_type_): _description_

    Returns:
        Number: Distance between the two annotations
    """
    # Point to point
    if isAPoint(annotation1) and isAPoint(annotation2):
      return  pointToPointDistance(annotation1["coordinates"][0], annotation2["coordinates"][0])
    
    # Compute centroid distance
    if (isAPoint(annotation1) and isAPoly(annotation2)) or (isAPoly(annotation1) and isAPoint(annotation2)):
      point = annotation1 if isAPoint(annotation1) else annotation2
      poly = annotation1 if isAPoly(annotation1) else annotation2
      centroid = simpleCentroid(poly["coordinates"])

      return pointToPointDistance(point["coordinates"][0], centroid)

    # Poly to poly
    if isAPoly(annotation1) and isAPoly(annotation2):
      centroid1 = simpleCentroid(annotation1["coordinates"])
      centroid2 = simpleCentroid(annotation2["coordinates"])
      return pointToPointDistance(centroid1, centroid2)
    
    return math.inf